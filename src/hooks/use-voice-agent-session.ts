"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentMicrophone,
  AgentSession,
  type AgentSettingsObject,
  type ConversationTextMessage,
} from "@deepgram/agents";
import type { VoiceOrbState } from "@/components/voice/voice-orb";
import { VOICE_AGENT_AUDIO } from "@/lib/voice-agent-audio";
import { VoiceAgentPlayer } from "@/lib/voice-agent-player";
import type { AssistantPageHint } from "@/lib/kimchi-assistant/types";
import { MAIL_VOICE_TOOL_NAMES } from "@/lib/kimchi-assistant/tools/registry";
import {
  applyVoiceAgentField,
  type VoiceAgentFieldName,
  type VoiceAgentFieldPatch,
} from "@/lib/voice-intake";

export type VoiceAgentContext = "onboarding" | "workspace";

export type VoiceAgentSessionResult = {
  summary: string;
  transcript: string;
};

type UseVoiceAgentSessionOptions = {
  context?: VoiceAgentContext;
  disabled?: boolean;
  voicePresetId?: string;
  /** Appended to onboarding config fetch — current coach step query string */
  onboardingCoachQuery?: string;
  /** Keep the same Deepgram session when coach step query changes (update prompt in place). */
  continuousOnboarding?: boolean;
  pageHint?: AssistantPageHint;
  onFieldUpdate?: (patch: VoiceAgentFieldPatch) => void;
  onOnboardingPropose?: (field: string, value: string) => void;
  onOnboardingConfirm?: (field: string) => void;
  onComplete?: (result: VoiceAgentSessionResult) => void;
  onNavigate?: (route: string, label?: string) => void;
};

function pageHintQuery(hint?: AssistantPageHint): string {
  if (!hint) return "";
  const params = new URLSearchParams();
  if (hint.pathname) params.set("pathname", hint.pathname);
  if (hint.jobDbId) params.set("jobDbId", hint.jobDbId);
  if (hint.jobRole) params.set("jobRole", hint.jobRole);
  if (hint.jobCompany) params.set("jobCompany", hint.jobCompany);
  if (hint.chatView) params.set("chatView", hint.chatView);
  const qs = params.toString();
  return qs ? `&${qs}` : "";
}

function logVoiceSessionDuration(context: VoiceAgentContext, startedAt: number | null) {
  if (!startedAt) return;
  const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  if (durationSeconds < 1) return;
  void fetch("/api/assistant/voice-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSeconds, context }),
  }).catch(() => {});
}

async function callMailTool(tool: string, args: Record<string, unknown>) {
  const res = await fetch("/api/assistant/mail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, args }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : "Could not complete that mail action.";
    return { ok: false, error: msg };
  }
  return { ok: true, data };
}

function buildTranscript(lines: Array<{ role: string; content: string }>): string {
  return lines.map((line) => `${line.role}: ${line.content}`).join("\n");
}

export type VoiceTranscriptLine = { role: string; content: string };

async function fetchVoiceAgentToken(): Promise<string> {
  const res = await fetch("/api/voice/agent/token", { cache: "no-store" });
  if (!res.ok) {
    let message = "Could not authorize voice agent";
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) message = text.slice(0, 240);
    }
    throw new Error(message);
  }
  return res.text();
}

export function useVoiceAgentSession({
  context = "workspace",
  disabled,
  voicePresetId = "general",
  onboardingCoachQuery = "",
  continuousOnboarding = false,
  pageHint,
  onFieldUpdate,
  onOnboardingPropose,
  onOnboardingConfirm,
  onComplete,
  onNavigate,
}: UseVoiceAgentSessionOptions = {}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettingsObject | null>(null);
  const [orbState, setOrbState] = useState<VoiceOrbState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [agentLine, setAgentLine] = useState<string | null>(null);
  const [transcriptLines, setTranscriptLines] = useState<VoiceTranscriptLine[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);

  const sessionRef = useRef<AgentSession | null>(null);
  const micRef = useRef<AgentMicrophone | null>(null);
  const playerRef = useRef<VoiceAgentPlayer | null>(null);
  const transcriptRef = useRef<Array<{ role: string; content: string }>>([]);
  const rafRef = useRef<number | null>(null);
  const uiModeRef = useRef<VoiceOrbState>("idle");
  const endingIntentionallyRef = useRef(false);
  const sessionStartedAtRef = useRef<number | null>(null);
  const pageHintRef = useRef(pageHint);
  pageHintRef.current = pageHint;
  const onOnboardingProposeRef = useRef(onOnboardingPropose);
  onOnboardingProposeRef.current = onOnboardingPropose;
  const onOnboardingConfirmRef = useRef(onOnboardingConfirm);
  onOnboardingConfirmRef.current = onOnboardingConfirm;
  const sessionActiveRef = useRef(sessionActive);
  sessionActiveRef.current = sessionActive;

  const setUiMode = useCallback((mode: VoiceOrbState) => {
    uiModeRef.current = mode;
    setOrbState(mode);
  }, []);

  useEffect(() => {
    if (continuousOnboarding && sessionActiveRef.current) return;

    void fetch(
      `/api/voice/agent/config?context=${context}&preset=${encodeURIComponent(voicePresetId)}${pageHintQuery(pageHint)}${onboardingCoachQuery}`,
      { cache: "no-store" },
    )
      .then((res) => res.json())
      .then((data) => {
        setAvailable(!!data?.agentAvailable);
        setAgentSettings(data?.agent ?? null);
      })
      .catch(() => setAvailable(false));
  }, [
    context,
    voicePresetId,
    continuousOnboarding,
    onboardingCoachQuery,
    pageHint?.pathname,
    pageHint?.jobDbId,
    pageHint?.jobRole,
    pageHint?.chatView,
  ]);

  const stopVisualizer = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startVisualizer = useCallback(() => {
    stopVisualizer();
    const tick = () => {
      const mic = micRef.current;
      const player = playerRef.current;
      const mode = uiModeRef.current;
      const level =
        mode === "speaking"
          ? (player?.getOutputVolume() ?? 0)
          : mode === "listening" || mode === "live"
            ? (mic?.getInputVolume() ?? 0)
            : 0;
      setAudioLevel(level);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopVisualizer]);

  const teardownSession = useCallback(() => {
    logVoiceSessionDuration(context, sessionStartedAtRef.current);
    sessionStartedAtRef.current = null;
    stopVisualizer();
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.dispose();
    playerRef.current = null;
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setSessionActive(false);
  }, [context, stopVisualizer]);

  useEffect(() => () => teardownSession(), [teardownSession]);

  const finishSession = useCallback(
    (resultSummary: string) => {
      const transcript = buildTranscript(transcriptRef.current);
      const header = `[Voice agent ${new Date().toISOString()}]\n${resultSummary}\n\n`;
      const payload: VoiceAgentSessionResult = {
        summary: resultSummary,
        transcript: `${header}${transcript}`.slice(0, 24000),
      };

      // Mark done before disconnect so the SDK "user requested disconnect" event
      // does not surface as an error.
      endingIntentionallyRef.current = true;
      setError(null);
      setSummary(resultSummary);
      setUiMode("done");
      teardownSession();
      onComplete?.(payload);
    },
    [onComplete, setUiMode, teardownSession],
  );

  const handleFieldSave = useCallback(
    (field: string, value: string) => {
      if (!field || !value || context !== "onboarding") return;
      const patch = applyVoiceAgentField(field as VoiceAgentFieldName, value);
      if (Object.keys(patch).length) onFieldUpdate?.(patch);
    },
    [context, onFieldUpdate],
  );

  const startSession = useCallback(async () => {
    if (disabled || !agentSettings || sessionActive) return;

    setError(null);
    setSummary(null);
    setAgentLine(null);
    transcriptRef.current = [];
    setTranscriptLines([]);
    setUiMode("connecting");

    try {
      const session = new AgentSession({
        auth: {
          tokenFactory: fetchVoiceAgentToken,
        },
        agent: agentSettings,
        audio: VOICE_AGENT_AUDIO,
        tags: ["kimchi", context],
      });

      const player = new VoiceAgentPlayer();
      await player.prepare();

      const mic = new AgentMicrophone((data) => session.sendAudio(data), {
        sampleRate: VOICE_AGENT_AUDIO.input.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      session.on("audio", (chunk) => player.queue(chunk));
      session.on("user-started-speaking", () => {
        player.interrupt();
        setUiMode("listening");
      });
      session.on("agent-thinking", () => setUiMode("thinking"));
      session.on("agent-started-speaking", () => setUiMode("speaking"));
      session.on("agent-audio-done", () => setUiMode("live"));
      session.on("conversation-text", (msg: ConversationTextMessage) => {
        const role = msg.role === "assistant" ? "Kimchi" : "You";
        const line = { role, content: msg.content };
        transcriptRef.current.push(line);
        setTranscriptLines((prev) => [...prev, line]);
        if (msg.role === "assistant") setAgentLine(msg.content);
      });
      session.on("function-call-request", (msg) => {
        for (const fn of msg.functions ?? []) {
          if (!fn.client_side) continue;
          try {
            const args = JSON.parse(fn.arguments || "{}") as Record<string, string>;
            if (
              fn.name === "save_onboarding_field" ||
              fn.name === "propose_onboarding_answer"
            ) {
              if (onOnboardingProposeRef.current) {
                onOnboardingProposeRef.current(args.field, args.value);
              } else {
                handleFieldSave(args.field, args.value);
              }
              session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: true }));
            } else if (
              fn.name === "propose_onboarding_company" &&
              args.companyName
            ) {
              onOnboardingProposeRef.current?.("company", args.companyName);
              session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: true }));
            } else if (fn.name === "confirm_onboarding_answer") {
              onOnboardingConfirmRef.current?.(args.field);
              session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: true }));
            } else if (fn.name === "confirm_onboarding_company") {
              onOnboardingConfirmRef.current?.("company");
              session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: true }));
            } else if (fn.name === "finish_onboarding_chat") {
              session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: true }));
              finishSession(args.summary || "Wrapped up your search preferences.");
            } else if (fn.name === "finish_voice_chat" && context === "workspace") {
              session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: true }));
              finishSession(args.summary || "Good chat — pick a next step below if you want.");
            } else if (fn.name === "open_ui_route" && args.route) {
              onNavigate?.(args.route, args.label);
              session.sendFunctionCallResponse(
                fn.id,
                fn.name,
                JSON.stringify({ ok: true, route: args.route }),
              );
            } else if (fn.name === "suggest_next_actions") {
              void (async () => {
                try {
                  const qs = pageHintQuery(pageHintRef.current);
                  const url = qs ? `/api/assistant/context?${qs.slice(1)}` : "/api/assistant/context";
                  const res = await fetch(url, { cache: "no-store" });
                  const data = (await res.json()) as { suggestions?: unknown[] };
                  session.sendFunctionCallResponse(
                    fn.id,
                    fn.name,
                    JSON.stringify({ ok: true, suggestions: data.suggestions ?? [] }),
                  );
                } catch {
                  session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: false }));
                }
              })();
            } else if (MAIL_VOICE_TOOL_NAMES.has(fn.name)) {
              void (async () => {
                const result = await callMailTool(fn.name, args as Record<string, unknown>);
                session.sendFunctionCallResponse(
                  fn.id,
                  fn.name,
                  JSON.stringify(result.ok ? result.data : { error: result.error }),
                );
              })();
            }
          } catch {
            session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: false }));
          }
        }
      });
      session.on("connected", () => {
        sessionStartedAtRef.current = Date.now();
        setSessionActive(true);
        setUiMode("live");
        startVisualizer();
      });
      session.on("disconnected", (reason) => {
        const benign =
          endingIntentionallyRef.current ||
          /user requested disconnect/i.test(reason ?? "");
        if (benign) {
          endingIntentionallyRef.current = false;
        } else if (uiModeRef.current !== "done" && uiModeRef.current !== "idle") {
          setError(reason || "Voice session ended");
          setUiMode("error");
        }
        setSessionActive(false);
        stopVisualizer();
      });
      session.on("error", (msg) => {
        setError(msg.description || "Voice agent error");
        setUiMode("error");
      });
      session.on("sdk-error", (err) => {
        setError(err.message || "Voice agent error");
        setUiMode("error");
      });

      sessionRef.current = session;
      micRef.current = mic;
      playerRef.current = player;

      await session.connect();
      await mic.start();
    } catch (err) {
      teardownSession();
      setError(err instanceof Error ? err.message : "Could not start voice agent");
      setUiMode("error");
    }
  }, [
    agentSettings,
    context,
    disabled,
    finishSession,
    handleFieldSave,
    onNavigate,
    sessionActive,
    setUiMode,
    startVisualizer,
    stopVisualizer,
    teardownSession,
  ]);

  const updateCoachPrompt = useCallback((prompt: string) => {
    sessionRef.current?.updatePrompt(prompt);
  }, []);

  const endSession = useCallback(() => {
    if (!sessionActive) return;
    finishSession("Wrapped up — see your summary below.");
  }, [finishSession, sessionActive]);

  const resetSession = useCallback(() => {
    endingIntentionallyRef.current = false;
    teardownSession();
    setSummary(null);
    setAgentLine(null);
    setTranscriptLines([]);
    setError(null);
    setUiMode("idle");
  }, [setUiMode, teardownSession]);

  const toggleSession = useCallback(() => {
    if (orbState === "done") {
      resetSession();
      return;
    }
    if (sessionActive) {
      endSession();
      return;
    }
    if (orbState === "idle" || orbState === "error") {
      void startSession();
    }
  }, [endSession, orbState, resetSession, sessionActive, startSession]);

  return {
    available,
    agentSettings,
    orbState,
    error,
    summary,
    agentLine,
    transcriptLines,
    audioLevel,
    sessionActive,
    startSession,
    endSession,
    resetSession,
    toggleSession,
    teardownSession,
    updateCoachPrompt,
  };
}
