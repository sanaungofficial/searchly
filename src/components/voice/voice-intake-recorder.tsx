"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentMicrophone,
  AgentPlayer,
  AgentSession,
  type AgentSettingsObject,
  type ConversationTextMessage,
} from "@deepgram/agents";
import { VoiceOrb, type VoiceOrbState } from "@/components/voice/voice-orb";
import {
  applyVoiceAgentField,
  type VoiceAgentFieldName,
  type VoiceAgentFieldPatch,
} from "@/lib/voice-intake";

export type { VoiceAgentFieldPatch };
export type VoiceAgentFieldUpdate = VoiceAgentFieldPatch;

export type VoiceAgentSessionResult = {
  summary: string;
  transcript: string;
};

/** @deprecated use VoiceAgentSessionResult */
export type VoiceIntakeResult = VoiceAgentSessionResult & {
  proposed?: Record<string, unknown>;
  fieldsFound?: string[];
};

interface VoiceIntakeRecorderProps {
  onFieldUpdate?: (patch: VoiceAgentFieldPatch) => void;
  onComplete?: (result: VoiceAgentSessionResult) => void;
  /** @deprecated use onFieldUpdate + onComplete */
  onVoiceIntakeComplete?: (result: VoiceIntakeResult) => void;
  disabled?: boolean;
}

type AgentUiMode = VoiceOrbState;

function buildTranscript(lines: Array<{ role: string; content: string }>): string {
  return lines.map((line) => `${line.role}: ${line.content}`).join("\n");
}

export function VoiceIntakeRecorder({
  onFieldUpdate,
  onComplete,
  onVoiceIntakeComplete,
  disabled,
}: VoiceIntakeRecorderProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [agentSettings, setAgentSettings] = useState<AgentSettingsObject | null>(null);
  const [orbState, setOrbState] = useState<AgentUiMode>("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [agentLine, setAgentLine] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);

  const sessionRef = useRef<AgentSession | null>(null);
  const micRef = useRef<AgentMicrophone | null>(null);
  const playerRef = useRef<AgentPlayer | null>(null);
  const transcriptRef = useRef<Array<{ role: string; content: string }>>([]);
  const rafRef = useRef<number | null>(null);
  const uiModeRef = useRef<AgentUiMode>("idle");

  const setUiMode = useCallback((mode: AgentUiMode) => {
    uiModeRef.current = mode;
    setOrbState(mode);
  }, []);

  useEffect(() => {
    void fetch("/api/voice/agent/config")
      .then((res) => res.json())
      .then((data) => {
        setAvailable(!!data?.agentAvailable);
        setAgentSettings(data?.agent ?? null);
      })
      .catch(() => setAvailable(false));
  }, []);

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
    stopVisualizer();
    micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.dispose();
    playerRef.current = null;
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setSessionActive(false);
  }, [stopVisualizer]);

  useEffect(() => () => teardownSession(), [teardownSession]);

  const finishSession = useCallback(
    (resultSummary: string) => {
      const transcript = buildTranscript(transcriptRef.current);
      const header = `[Voice agent ${new Date().toISOString()}]\n${resultSummary}\n\n`;
      const payload: VoiceAgentSessionResult = {
        summary: resultSummary,
        transcript: `${header}${transcript}`.slice(0, 24000),
      };

      teardownSession();
      setSummary(resultSummary);
      setUiMode("done");
      onComplete?.(payload);
      onVoiceIntakeComplete?.({
        ...payload,
        proposed: {},
        fieldsFound: [],
      });
    },
    [onComplete, onVoiceIntakeComplete, setUiMode, teardownSession],
  );

  const handleFieldSave = useCallback(
    (field: string, value: string) => {
      if (!field || !value) return;
      const patch = applyVoiceAgentField(field as VoiceAgentFieldName, value);
      if (Object.keys(patch).length) onFieldUpdate?.(patch);
    },
    [onFieldUpdate],
  );

  const startSession = useCallback(async () => {
    if (disabled || !agentSettings || sessionActive) return;

    setError(null);
    setSummary(null);
    setAgentLine(null);
    transcriptRef.current = [];
    setUiMode("connecting");

    try {
      const session = new AgentSession({
        auth: {
          tokenFactory: () => fetch("/api/voice/agent/token", { cache: "no-store" }).then((r) => {
            if (!r.ok) throw new Error("Could not authorize voice agent");
            return r.text();
          }),
        },
        agent: agentSettings,
        tags: ["kimchi", "onboarding"],
      });

      const player = new AgentPlayer();
      const mic = new AgentMicrophone((data) => session.sendAudio(data));

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
        transcriptRef.current.push({ role, content: msg.content });
        if (msg.role === "assistant") setAgentLine(msg.content);
      });
      session.on("function-call-request", (msg) => {
        for (const fn of msg.functions ?? []) {
          if (!fn.client_side) continue;
          try {
            const args = JSON.parse(fn.arguments || "{}") as Record<string, string>;
            if (fn.name === "save_onboarding_field") {
              handleFieldSave(args.field, args.value);
              session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: true }));
            } else if (fn.name === "finish_onboarding_chat") {
              session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: true }));
              finishSession(args.summary || "Wrapped up your search preferences.");
            }
          } catch {
            session.sendFunctionCallResponse(fn.id, fn.name, JSON.stringify({ ok: false }));
          }
        }
      });
      session.on("connected", () => {
        setSessionActive(true);
        setUiMode("live");
        startVisualizer();
      });
      session.on("disconnected", (reason) => {
        if (uiModeRef.current !== "done" && uiModeRef.current !== "idle") {
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
    disabled,
    finishSession,
    handleFieldSave,
    sessionActive,
    setUiMode,
    startVisualizer,
    stopVisualizer,
    teardownSession,
  ]);

  const endSession = useCallback(() => {
    if (!sessionActive) return;
    finishSession(summary || "Voice intake ended — your picks below are saved.");
  }, [finishSession, sessionActive, summary]);

  const handleOrbClick = useCallback(() => {
    if (orbState === "done") {
      setUiMode("idle");
      setSummary(null);
      setAgentLine(null);
      return;
    }
    if (sessionActive) {
      endSession();
      return;
    }
    if (orbState === "idle" || orbState === "error") {
      void startSession();
    }
  }, [endSession, orbState, sessionActive, setUiMode, startSession]);

  if (available === false) return null;

  const hint =
    orbState === "idle" || orbState === "error"
      ? "Tap the orb — Kimchi will ask a few quick questions out loud. Prefer typing? Use the picks below anytime."
      : orbState === "done"
        ? undefined
        : orbState === "connecting" || orbState === "thinking"
          ? "Connecting…"
          : sessionActive
            ? "Tap the orb when you're done talking."
            : undefined;

  return (
    <div className="voice-intake-hero anim-fade-up">
      <VoiceIntakeHeroStyles />
      <div className="voice-intake-hero__panel">
        <p className="voice-intake-hero__eyebrow">Talk to Kimchi</p>
        <h3 className="voice-intake-hero__title">Skip the forms — have a quick conversation.</h3>

        <VoiceOrb
          state={orbState}
          audioLevel={audioLevel}
          onClick={handleOrbClick}
          disabled={disabled || available !== true || !agentSettings}
          label={
            orbState === "idle"
              ? "Tap to talk"
              : orbState === "live"
                ? "Listening"
                : undefined
          }
        />

        {agentLine && orbState !== "idle" && orbState !== "done" && (
          <div className="voice-intake-hero__bubble" aria-live="polite">
            <span className="voice-intake-hero__bubble-label">Kimchi</span>
            <p>{agentLine}</p>
          </div>
        )}

        {hint && <p className="voice-intake-hero__hint">{hint}</p>}

        {orbState === "done" && summary && (
          <div className="voice-intake-hero__success">
            <p>{summary}</p>
            <button
              type="button"
              className="voice-intake-hero__again"
              onClick={() => {
                setUiMode("idle");
                setSummary(null);
                setAgentLine(null);
              }}
            >
              Talk again
            </button>
          </div>
        )}

        {error && <p className="voice-intake-hero__error">{error}</p>}
      </div>
    </div>
  );
}

function VoiceIntakeHeroStyles() {
  return (
    <style>{`
      .voice-intake-hero { width: 100%; }

      .voice-intake-hero__panel {
        position: relative;
        overflow: hidden;
        padding: clamp(28px, 6vw, 44px) clamp(20px, 5vw, 36px);
        background:
          radial-gradient(circle at 20% 0%, rgba(61, 170, 156, 0.12), transparent 42%),
          radial-gradient(circle at 80% 100%, rgba(196, 168, 106, 0.1), transparent 38%),
          linear-gradient(180deg, #eef5f2 0%, #f7f5f2 100%);
        border: 1.5px solid rgba(26, 58, 47, 0.12);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
      }

      .voice-intake-hero__panel::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image: radial-gradient(rgba(26, 58, 47, 0.04) 1px, transparent 1px);
        background-size: 18px 18px;
        pointer-events: none;
        opacity: 0.5;
      }

      .voice-intake-hero__eyebrow {
        position: relative;
        margin: 0;
        font-family: var(--font-ui);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.55);
      }

      .voice-intake-hero__title {
        position: relative;
        margin: 0 0 12px;
        max-width: 420px;
        font-family: var(--font-display);
        font-size: clamp(20px, 3.2vw, 26px);
        line-height: 1.25;
        color: #1A3A2F;
        font-weight: 600;
      }

      .voice-intake-hero__bubble {
        position: relative;
        margin-top: 8px;
        max-width: 420px;
        padding: 14px 18px;
        background: rgba(15, 36, 28, 0.92);
        border: 1px solid rgba(91, 196, 184, 0.25);
        text-align: left;
      }

      .voice-intake-hero__bubble-label {
        display: block;
        margin-bottom: 6px;
        font-family: var(--font-ui);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(91, 196, 184, 0.85);
      }

      .voice-intake-hero__bubble p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.55;
        color: rgba(247, 245, 242, 0.92);
      }

      .voice-intake-hero__hint {
        position: relative;
        margin: 4px 0 0;
        max-width: 380px;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.55;
        color: rgba(26, 58, 47, 0.72);
      }

      .voice-intake-hero__success {
        position: relative;
        margin-top: 8px;
        max-width: 420px;
        padding: 14px 18px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(26, 58, 47, 0.12);
      }

      .voice-intake-hero__success p {
        margin: 0;
        font-family: var(--font-ui);
        font-size: 15px;
        line-height: 1.5;
        color: #1A3A2F;
      }

      .voice-intake-hero__again {
        margin-top: 12px;
        background: transparent;
        border: none;
        padding: 0;
        font-family: var(--font-ui);
        font-size: 14px;
        color: rgba(26, 58, 47, 0.65);
        cursor: pointer;
        text-decoration: underline;
      }

      .voice-intake-hero__error {
        position: relative;
        margin: 8px 0 0;
        max-width: 380px;
        font-family: var(--font-ui);
        font-size: 14px;
        line-height: 1.5;
        color: #9B3A2A;
      }
    `}</style>
  );
}
