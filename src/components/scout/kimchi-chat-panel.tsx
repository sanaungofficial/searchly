"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useVoiceAgentSession, type VoiceAgentSessionResult } from "@/hooks/use-voice-agent-session";
import type { useKimchiThreads } from "@/hooks/use-kimchi-threads";
import type { DebriefAction } from "@/lib/kimchi-assistant/debrief";
import type { StoredThreadMessage } from "@/lib/kimchi-assistant/thread-serialize";
import type {
  AssistantContextPayload,
  AssistantPageHint,
} from "@/lib/kimchi-assistant/types";
import { VOICE_PRESETS, getVoicePreset, type VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";
import {
  buildFollowUpChips,
  buildContextSuggestionChips,
  buildWelcomeChips,
  formatThreadForFollowUps,
  formatThreadForCopy,
  isFailedAssistantReply,
  isWelcomeOnlyThread,
  WELCOME_MESSAGE,
  guidanceForChip,
  type AssistantChip,
  legacyToChips,
} from "@/lib/kimchi-assistant/chat-chips";
import { profileLearningPathUrl, pipelineJobUrl, profileTargetCompaniesUrl } from "@/lib/workspace-urls";
import { ProfileResumeEditor } from "@/components/scout/profile-resume-editor";
import { CreditsInlineHint } from "@/components/scout/credits-display";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { notifyCreditsChanged } from "@/lib/credits";
import { fontSans } from "@/lib/typography";
import { useWorkspace } from "@/contexts/workspace-context";
import { STAGE_LABELS } from "./workspace-data";
import {
  KimchiAssistantChipRow,
  KimchiStarterSection,
  KimchiTypingIndicator,
  KimchiCopyButton,
  KimchiEmailInsightDrawer,
  KimchiSaveIntakeModal,
  KimchiStrategyGenerateModal,
  KimchiTranscriptModal,
} from "@/components/scout/kimchi-chat-extras";
import { VoiceOrb } from "@/components/voice/voice-orb";

const KIMCHI_NAV_MARKER = /<!--kimchi-nav:([^>]+)-->/;

function stripKimchiNavMarker(text: string): { text: string; route: string | null } {
  const match = text.match(KIMCHI_NAV_MARKER);
  if (!match) return { text, route: null };
  return { text: text.replace(KIMCHI_NAV_MARKER, "").trimEnd(), route: match[1] ?? null };
}

const sans = fontSans;

type VoiceMessage = StoredThreadMessage & {
  kind: "voice";
  debriefLoading?: boolean;
};

type Props = {
  pageHint?: AssistantPageHint;
  voiceUnavailable?: boolean;
  threads: ReturnType<typeof useKimchiThreads>;
  onNavigate?: (href: string) => void;
};

function contextQuery(pageHint?: AssistantPageHint): string {
  if (!pageHint) return "";
  const p = new URLSearchParams();
  if (pageHint.pathname) p.set("pathname", pageHint.pathname);
  if (pageHint.jobDbId) p.set("jobDbId", pageHint.jobDbId);
  if (pageHint.jobRole) p.set("jobRole", pageHint.jobRole);
  if (pageHint.jobCompany) p.set("jobCompany", pageHint.jobCompany);
  if (pageHint.chatView) p.set("chatView", pageHint.chatView);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function KimchiChatPanel({ pageHint, voiceUnavailable, threads, onNavigate }: Props) {
  const router = useRouter();
  const { openPricing, kanbanCards, user, withClientScope, withClientReviewPath } = useWorkspace();
  const { messages, setMessages, ensureThread, updateLastAssistant, persistMessages, activeThreadId, activeThreadTitle } =
    threads;

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [assistantCtx, setAssistantCtx] = useState<AssistantContextPayload | null>(null);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<VoicePresetId>("general");
  const [transcriptModal, setTranscriptModal] = useState<{ title: string; body: string } | null>(null);
  const [insightActivityId, setInsightActivityId] = useState<string | null>(null);
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [resumeAssetId, setResumeAssetId] = useState<string | null>(null);
  const [resumeContextNotes, setResumeContextNotes] = useState<string | null>(null);
  const [saveIntakeModal, setSaveIntakeModal] = useState<{ excerpt: string; presetTitle: string } | null>(null);
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);
  const [followUpChips, setFollowUpChips] = useState<AssistantChip[]>([]);
  const [followUpAiLoading, setFollowUpAiLoading] = useState(false);
  const [canAskAiSuggestions, setCanAskAiSuggestions] = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [nextStepsVisible, setNextStepsVisible] = useState(false);
  const [inboxScanning, setInboxScanning] = useState(false);
  const [forYouChips, setForYouChips] = useState<AssistantChip[]>([]);
  const [forYouLoading, setForYouLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activePresetRef = useRef<VoicePresetId>("general");
  const lastFollowUpContextRef = useRef<{
    userMessage: string;
    assistantMessage: string;
    thread: Array<{ role: string; content: string }>;
    threadContext: string;
  } | null>(null);
  const [pendingVoiceStart, setPendingVoiceStart] = useState(false);

  const pipelineJobs = kanbanCards
    .map((c) => {
      const ext = c as typeof c & { _dbId?: string };
      if (!ext._dbId) return null;
      return { id: ext._dbId, company: c.company, role: c.role, stage: STAGE_LABELS[c.stage] };
    })
    .filter(Boolean) as Array<{ id: string; company: string; role: string; stage: string }>;

  const runDebrief = useCallback(
    async (presetId: VoicePresetId, result: VoiceAgentSessionResult) => {
      const preset = getVoicePreset(presetId);
      const placeholder: VoiceMessage = {
        kind: "voice",
        presetId,
        presetTitle: preset.title,
        summary: "Summarizing what you said…",
        bullets: [],
        actions: [],
        rawTranscript: result.transcript,
        debriefLoading: true,
      };

      setMessages((prev) => [...prev, placeholder]);
      await ensureThread();

      try {
        const res = await fetch("/api/assistant/voice-debrief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId,
            transcript: result.transcript,
            contextHint: {
              focusedJobId: pageHint?.jobDbId ?? null,
              pipelineJobs,
              contextSources: assistantCtx?.contextSources?.map((s) => ({
                id: s.id,
                label: s.label,
                route: s.route,
              })),
            },
          }),
        });
        const data = res.ok ? await res.json() : null;
        const finalVoice: VoiceMessage = {
          kind: "voice",
          presetId,
          presetTitle: preset.title,
          summary: data?.summary ?? result.summary,
          bullets: data?.bullets ?? [],
          actions: data?.actions ?? [],
          rawTranscript: result.transcript,
        };

        setMessages((prev) => {
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i--) {
            const m = copy[i];
            if (m.kind === "voice" && (m as VoiceMessage).debriefLoading) {
              copy[i] = finalVoice;
              break;
            }
          }
          return copy;
        });
        const threadId = await ensureThread();
        if (threadId) void threads.persistMessages(threadId, [finalVoice]);
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.kind === "voice" && (m as VoiceMessage).debriefLoading
              ? {
                  ...m,
                  kind: "voice" as const,
                  debriefLoading: undefined,
                  summary: result.summary || "Voice chat saved — ask me to recap anytime.",
                }
              : m,
          ),
        );
      }
    },
    [ensureThread, setMessages, threads, pageHint?.jobDbId, pipelineJobs, assistantCtx?.contextSources],
  );

  const onVoiceComplete = useCallback(
    (result: VoiceAgentSessionResult) => {
      void runDebrief(activePresetRef.current, result);
    },
    [runDebrief],
  );

  const {
    available: voiceAvailable,
    orbState,
    error: voiceError,
    audioLevel,
    sessionActive,
    transcriptLines,
    toggleSession,
    endSession,
    agentSettings,
  } = useVoiceAgentSession({
    context: "workspace",
    voicePresetId: selectedPreset,
    pageHint,
    disabled: voiceUnavailable,
    onComplete: onVoiceComplete,
    onNavigate: (route) => {
      if (onNavigate) onNavigate(route);
      else router.push(route);
    },
  });

  useEffect(() => {
    if (pendingVoiceStart && agentSettings && !sessionActive) {
      setPendingVoiceStart(false);
      toggleSession();
    }
  }, [pendingVoiceStart, agentSettings, sessionActive, toggleSession]);

  const loadContext = useCallback(() => {
    void (async () => {
      try {
        const r = await fetch(withClientScope(`/api/assistant/context${contextQuery(pageHint)}`), {
          cache: "no-store",
        });
        if (!r.ok) return;
        const data = (await r.json()) as AssistantContextPayload & { autoInboxTriageOnOpen?: boolean };
        setAssistantCtx(data);
        if (data.autoInboxTriageOnOpen) {
          await fetch("/api/assistant/mail/sync-on-open", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          }).catch(() => {});
          const refresh = await fetch(withClientScope(`/api/assistant/context${contextQuery(pageHint)}`), {
            cache: "no-store",
          });
          if (refresh.ok) setAssistantCtx((await refresh.json()) as AssistantContextPayload);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [pageHint, withClientScope]);

  const scanInboxWithAi = useCallback(async () => {
    setInboxScanning(true);
    try {
      await fetch("/api/assistant/mail/sync-on-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triage: true }),
      });
      loadContext();
      setSuggestionsVisible(true);
    } catch {
      /* ignore */
    } finally {
      setInboxScanning(false);
    }
  }, [loadContext]);

  const loadForYou = useCallback(async () => {
    if (forYouLoading) return;
    setForYouLoading(true);
    try {
      const res = await fetch(withClientScope("/api/assistant/for-you"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageHint }),
      });
      if (res.status === 402) {
        notifyCreditsChanged();
        return;
      }
      const data = res.ok ? await res.json() : null;
      if (Array.isArray(data?.chips) && data.chips.length > 0) {
        setForYouChips(data.chips as AssistantChip[]);
        setSuggestionsVisible(true);
      }
      if (data?.source === "ai") notifyCreditsChanged();
    } catch {
      /* rule-based fallback handled server-side */
    } finally {
      setForYouLoading(false);
    }
  }, [forYouLoading, pageHint, withClientScope]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    setFollowUpChips([]);
    setCanAskAiSuggestions(false);
    setNextStepsVisible(false);
    setSuggestionsVisible(false);
    setForYouChips([]);
  }, [activeThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, followUpChips]);

  const welcomeOnly = isWelcomeOnlyThread(messages, activeThreadTitle);
  const welcomeChips = buildWelcomeChips(assistantCtx);

  const contextSuggestionChips =
    forYouChips.length > 0 ? forYouChips : buildContextSuggestionChips(assistantCtx);
  const hasUserMessages = messages.some((m) => (m.kind === "text" || !m.kind) && m.role === "user");
  const lastTextMessages = messages.filter(
    (m): m is StoredThreadMessage & { kind: "text" } => m.kind === "text",
  );
  const lastUserMessage = [...lastTextMessages].reverse().find((m) => m.role === "user")?.content ?? "";
  const lastAssistantMessage = [...lastTextMessages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const canGenerateNextSteps =
    !streaming &&
    !welcomeOnly &&
    hasUserMessages &&
    !!lastAssistantMessage.trim() &&
    !isFailedAssistantReply(lastAssistantMessage);

  const goTo = useCallback(
    (href: string) => {
      const scoped = withClientReviewPath(href);
      if (onNavigate) onNavigate(scoped);
      else router.push(scoped);
    },
    [onNavigate, router, withClientReviewPath],
  );

  const openResumeEditor = useCallback(async () => {
    const res = await fetch(withClientScope("/api/assets"));
    const rows = await res.json();
    const resume = Array.isArray(rows) ? rows.find((a: { type?: string }) => a.type === "RESUME") : null;
    if (!resume?.id) {
      goTo("/profile/assets");
      return;
    }
    setResumeAssetId(resume.id);
    setResumeContextNotes(null);
    setResumeEditorOpen(true);
  }, [goTo, withClientScope]);

  const addSkillAndNavigate = useCallback(
    async (skill: string) => {
      const profileRes = await fetch(withClientScope("/api/profile"));
      const profile = profileRes.ok ? await profileRes.json() : null;
      const existing = Array.isArray(profile?.skillGoals) ? profile.skillGoals : [];
      const next = [
        ...existing.filter((g: { skill?: string }) => g.skill?.toLowerCase() !== skill.toLowerCase()),
        { skill, status: "queued", addedAt: new Date().toISOString() },
      ];
      await fetch(withClientScope("/api/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillGoals: next }),
      });
      goTo(profileLearningPathUrl(skill));
    },
    [goTo, withClientScope],
  );

  const appendGuidanceMessage = useCallback(
    async (content: string) => {
      const msg: StoredThreadMessage = { kind: "text", role: "assistant", content };
      setMessages((prev) => [...prev, msg]);
      const threadId = activeThreadId ?? (await ensureThread());
      if (threadId) void persistMessages(threadId, [msg]);
    },
    [activeThreadId, ensureThread, persistMessages, setMessages],
  );

  const navigateWithGuidance = useCallback(
    async (chip: AssistantChip, href: string) => {
      const guidance = guidanceForChip(chip);
      if (guidance) await appendGuidanceMessage(guidance);
      goTo(href);
    },
    [appendGuidanceMessage, goTo],
  );

  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const handleChipActivate = useCallback(
    (chip: AssistantChip) => {
      const { action } = chip;
      switch (action.type) {
        case "chat":
          sendMessageRef.current(action.prompt);
          break;
        case "navigate":
          void navigateWithGuidance(chip, action.href);
          break;
        case "open_resume":
          void navigateWithGuidance(chip, "/profile/assets");
          break;
        case "open_strategy":
          void navigateWithGuidance(chip, "/profile/career-strategy");
          break;
        case "generate_strategy":
          setStrategyModalOpen(true);
          break;
        case "inbox_insight":
          if (action.activityId) setInsightActivityId(action.activityId);
          else void navigateWithGuidance(chip, "/inbox");
          break;
        case "add_skill":
          void (async () => {
            await addSkillAndNavigate(action.skill);
            const guidance = guidanceForChip(chip);
            if (guidance) await appendGuidanceMessage(guidance);
          })();
          break;
      }
    },
    [addSkillAndNavigate, appendGuidanceMessage, navigateWithGuidance],
  );

  const loadAiFollowUpChips = useCallback(async () => {
    const ctx = lastFollowUpContextRef.current;
    if (!ctx || followUpAiLoading || isFailedAssistantReply(ctx.assistantMessage)) return;

    setFollowUpAiLoading(true);
    try {
      const res = await fetch("/api/assistant/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: ctx.userMessage,
          assistantMessage: ctx.assistantMessage,
          threadMessages: ctx.thread,
          threadContext: ctx.threadContext,
          profileGaps: assistantCtx?.profileGaps,
          strategySnippet: assistantCtx?.strategySnippet,
          pipelineSnippet: assistantCtx?.pipelineSnippet,
          useAi: true,
        }),
      });
      const data = res.ok ? await res.json() : null;
      if (Array.isArray(data?.chips) && data.chips[0]?.action) {
        setFollowUpChips(data.chips as AssistantChip[]);
        return;
      }
      if (Array.isArray(data?.chips) && data.chips.length >= 2) {
        setFollowUpChips(legacyToChips(data.chips));
      }
    } catch {
      /* keep rule-based chips */
    } finally {
      setFollowUpAiLoading(false);
    }
  }, [
    assistantCtx?.pipelineSnippet,
    assistantCtx?.profileGaps,
    assistantCtx?.strategySnippet,
    followUpAiLoading,
  ]);

  const generateNextSteps = useCallback(() => {
    if (!canGenerateNextSteps) return;

    const textThread = messages
      .filter((m): m is StoredThreadMessage & { kind: "text" } => m.kind === "text")
      .map((m) => ({ role: m.role, content: m.content }));
    const threadContext = formatThreadForFollowUps(textThread.slice(0, -1));

    lastFollowUpContextRef.current = {
      userMessage: lastUserMessage,
      assistantMessage: lastAssistantMessage,
      thread: textThread,
      threadContext,
    };

    setFollowUpChips(
      buildFollowUpChips({
        userMessage: lastUserMessage,
        assistantMessage: lastAssistantMessage,
        threadContext,
        profileGaps: assistantCtx?.profileGaps,
        ctx: assistantCtx,
      }),
    );
    setCanAskAiSuggestions(!isFailedAssistantReply(lastAssistantMessage));
    setNextStepsVisible(true);
  }, [
    assistantCtx,
    canGenerateNextSteps,
    lastAssistantMessage,
    lastUserMessage,
    messages,
  ]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setFollowUpChips([]);
    setCanAskAiSuggestions(false);
    setNextStepsVisible(false);
    setSuggestionsVisible(false);

    const textThread = messages.filter(
      (m): m is StoredThreadMessage & { kind: "text" } => m.kind === "text",
    );
    const nextMessages = [...textThread, { role: "user" as const, content: trimmed }];

    const userMsg: StoredThreadMessage = { kind: "text", role: "user", content: trimmed };
    const assistantPlaceholder: StoredThreadMessage = { kind: "text", role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    const threadId = await ensureThread();
    if (threadId) void persistMessages(threadId, [userMsg]);

    setInput("");
    setStreaming(true);

    let accumulated = "";
    try {
      const pipeline = kanbanCards.map((c) => ({
        company: c.company,
        role: c.role,
        stage: STAGE_LABELS[c.stage],
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, pipeline, focusedJob: null }),
      });

      if (!res.ok) {
        if (res.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
          setMessages((prev) => prev.slice(0, -1));
          return;
        }
        if (res.status === 503) {
          updateLastAssistant(
            "Kimchi AI isn't available — check that Vercel AI Gateway is configured on this environment.",
          );
          return;
        }
        updateLastAssistant("That didn't work — try again.");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        updateLastAssistant(accumulated);
      }
      const { text: finalText, route: navRoute } = stripKimchiNavMarker(accumulated);
      accumulated = finalText;
      if (!accumulated.trim()) {
        accumulated =
          "I couldn't generate a reply just now. Try sending that again, or use the buttons below.";
      }
      updateLastAssistant(accumulated);
      if (navRoute) {
        goTo(navRoute);
      }
      notifyCreditsChanged();
      if (threadId && accumulated.trim() && !isFailedAssistantReply(accumulated)) {
        void persistMessages(threadId, [{ kind: "text", role: "assistant", content: accumulated }]);
      }
      const fullThread = [
        ...textThread.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: trimmed },
        { role: "assistant", content: accumulated },
      ];
      lastFollowUpContextRef.current = {
        userMessage: trimmed,
        assistantMessage: accumulated,
        thread: fullThread,
        threadContext: formatThreadForFollowUps(fullThread.slice(0, -1)),
      };
      setCanAskAiSuggestions(!isFailedAssistantReply(accumulated));
      setNextStepsVisible(false);
      setFollowUpChips([]);
    } catch {
      updateLastAssistant("Couldn't reach Kimchi — check your connection.");
    } finally {
      setStreaming(false);
    }
  };

  sendMessageRef.current = (text: string) => {
    void sendMessage(text);
  };

  const appendStrategyIntake = async (msg: VoiceMessage, opts?: { silent?: boolean }) => {
    const block = msg.rawTranscript.slice(0, 8000);
    const res = await fetch("/api/assistant/strategy-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        block,
        presetTitle: msg.presetTitle,
        summary: msg.summary,
      }),
    });
    const data = res.ok ? await res.json() : null;
    if (!data?.ok) {
      void sendMessage("I couldn't save to strategy intake — try again from Profile.");
      return false;
    }
    if (!opts?.silent) {
      setSaveIntakeModal({
        excerpt: data.savedExcerpt ?? msg.summary,
        presetTitle: msg.presetTitle,
      });
    }
    return true;
  };

  const handleDebriefAction = async (msg: VoiceMessage, action: DebriefAction) => {
    const legacyType = action.type as string;

    const resolveJobId = (): string | null => {
      if (action.payload?.jobId) return action.payload.jobId;
      if (pageHint?.jobDbId) return pageHint.jobDbId;
      const interviewing = pipelineJobs.filter((j) => /interview/i.test(j.stage));
      if (interviewing.length === 1) return interviewing[0]!.id;
      return null;
    };

    if (action.type === "open_pipeline_job") {
      const jobId = resolveJobId();
      if (!jobId) {
        void sendMessage("Which role should I open — company and title?");
        return;
      }
      goTo(pipelineJobUrl(jobId));
      return;
    }
    if (action.type === "open_target_company") {
      const companyId = action.payload?.companyId;
      goTo(companyId ? profileTargetCompaniesUrl(companyId) : "/profile/target-companies");
      return;
    }
    if (action.type === "save_job_notes") {
      const jobId = resolveJobId();
      if (!jobId) {
        void sendMessage("Which pipeline role should I save these prep notes to?");
        return;
      }
      const note = [msg.summary, ...msg.bullets].filter(Boolean).join("\n").slice(0, 4000);
      const res = await fetch("/api/assistant/voice-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "save_job_note", args: { jobId, note } }),
      });
      if (res.ok) {
        const job = pipelineJobs.find((j) => j.id === jobId);
        void sendMessage(
          job
            ? `Saved prep notes to ${job.role} at ${job.company}.`
            : "Saved prep notes to that role.",
        );
        goTo(pipelineJobUrl(jobId));
      } else {
        void sendMessage("Couldn't save those notes — try again from the role card.");
      }
      return;
    }
    if (action.type === "generate_career_strategy") {
      await appendStrategyIntake(msg, { silent: true });
      setStrategyModalOpen(true);
      return;
    }
    if (legacyType === "save_strategy_notes" || action.type === "append_strategy_intake") {
      await appendStrategyIntake(msg);
      return;
    }
    if (action.type === "open_resume_editor") {
      const res = await fetch(withClientScope("/api/assets"));
      const rows = await res.json();
      const resume = Array.isArray(rows) ? rows.find((a: { type?: string }) => a.type === "RESUME") : null;
      if (!resume?.id) {
        void sendMessage("I want to work on my resume based on our voice chat.");
        return;
      }
      setResumeAssetId(resume.id);
      setResumeContextNotes(`${msg.summary}\n\n${msg.rawTranscript.slice(0, 4000)}`);
      setResumeEditorOpen(true);
      return;
    }
    if (legacyType === "open_inbox_peek" || action.type === "open_inbox_activity") {
      const activityId =
        action.payload?.activityId ?? assistantCtx?.inbox?.activities[0]?.id ?? null;
      if (activityId) setInsightActivityId(activityId);
      else void sendMessage("Walk me through my inbox updates.");
      return;
    }
    if (action.type === "ask_in_chat" && action.payload?.prompt) {
      void sendMessage(action.payload.prompt);
    }
  };

  const startPresetVoice = (presetId: VoicePresetId) => {
    activePresetRef.current = presetId;
    setSelectedPreset(presetId);
    setPresetMenuOpen(false);
    setPendingVoiceStart(true);
  };

  const userInitials = (() => {
    const name = user?.name?.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
      return parts[0]!.slice(0, 2).toUpperCase();
    }
    const email = user?.email?.trim();
    if (email) return email.slice(0, 2).toUpperCase();
    return "You";
  })();

  return (
    <div className="kimchi-chat-panel">
      <div className="kimchi-chat-panel__thread">
        {messages.map((msg, i) => {
          if (msg.kind === "voice") {
            const vm = msg as VoiceMessage;
            const preset = getVoicePreset(vm.presetId);
            return (
              <div
                key={msg.id ?? `voice-${i}`}
                className="kimchi-voice-block"
                style={{ borderLeftColor: preset.accent, borderLeftWidth: 3, borderLeftStyle: "solid" }}
              >
                <p className="kimchi-voice-block__eyebrow">
                  <span className="kimchi-voice-block__emoji" aria-hidden="true">{preset.emoji}</span>
                  Voice · {vm.presetTitle}
                </p>
                <p className="kimchi-voice-block__summary">{vm.summary}</p>
                {vm.bullets.length > 0 && (
                  <ul className="kimchi-voice-block__bullets">
                    {vm.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {!vm.debriefLoading && vm.actions.length > 0 && (
                  <KimchiAssistantChipRow
                    chips={vm.actions.map((a) => ({
                      id: a.id,
                      label: a.label,
                      hint: "hint" in a ? a.hint : undefined,
                      variant: "action" as const,
                      action: { type: "chat" as const, prompt: a.label },
                    }))}
                    onActivate={(chip) => {
                      const action = vm.actions.find((x) => x.id === chip.id);
                      if (action) void handleDebriefAction(vm, action);
                    }}
                  />
                )}
                <button
                  type="button"
                  className="kimchi-voice-block__transcript"
                  onClick={() =>
                    setTranscriptModal({ title: `Transcript · ${vm.presetTitle}`, body: vm.rawTranscript })
                  }
                >
                  View full transcript
                </button>
              </div>
            );
          }
          const isStreamingPlaceholder =
            streaming && i === messages.length - 1 && msg.role === "assistant" && !msg.content?.trim();
          const displayContent =
            msg.role === "user"
              ? msg.content
              : welcomeOnly && i === messages.length - 1
                ? WELCOME_MESSAGE
                : isStreamingPlaceholder
                  ? null
                  : msg.content;
          const copyText =
            msg.role === "user"
              ? msg.content
              : welcomeOnly && i === messages.length - 1
                ? WELCOME_MESSAGE
                : msg.content;
          const canCopy = !!copyText?.trim() && !isStreamingPlaceholder;

          return (
            <div
              key={msg.id ?? `t-${i}-${msg.content.slice(0, 12)}`}
              className={`kimchi-msg-row kimchi-msg-row--${msg.role}`}
            >
              {msg.role === "assistant" && (
                <div className="kimchi-msg-avatar kimchi-msg-avatar--kimchi" aria-hidden="true">
                  ✦
                </div>
              )}
              <div className="kimchi-msg-body">
                <div className="kimchi-msg-meta">
                  {msg.role === "assistant" && <span className="kimchi-msg-sender">Kimchi</span>}
                  {msg.role === "user" && <span className="kimchi-msg-sender kimchi-msg-sender--user">You</span>}
                  {canCopy && <KimchiCopyButton text={copyText} label="Copy message" />}
                </div>
                <div className={`kimchi-chat-bubble kimchi-chat-bubble--${msg.role}`}>
                  {msg.role === "user" ? (
                    displayContent
                  ) : isStreamingPlaceholder ? (
                    <KimchiTypingIndicator />
                  ) : (
                    <ReactMarkdown>{displayContent ?? ""}</ReactMarkdown>
                  )}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="kimchi-msg-avatar kimchi-msg-avatar--user" aria-hidden="true">
                  {userInitials}
                </div>
              )}
            </div>
          );
        })}

        {welcomeOnly && welcomeChips.length > 0 && (
          <KimchiStarterSection
            actions={welcomeChips}
            chatChips={[]}
            loading={false}
            onActivate={handleChipActivate}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {!welcomeOnly &&
        (contextSuggestionChips.length > 0 ||
          canGenerateNextSteps ||
          assistantCtx?.inbox?.emailConnected) && (
        <div className="kimchi-suggestions-bar">
          {!suggestionsVisible && contextSuggestionChips.length > 0 && (
            <button
              type="button"
              className="kimchi-suggest-trigger"
              disabled={forYouLoading}
              onClick={() => {
                if (forYouChips.length === 0) void loadForYou();
                setSuggestionsVisible(true);
              }}
            >
              {forYouLoading
                ? "Personalizing for you…"
                : hasUserMessages
                  ? "✦ What to focus on"
                  : "✦ What to focus on"}
            </button>
          )}
          {suggestionsVisible && contextSuggestionChips.length > 0 && (
            <KimchiAssistantChipRow
              chips={contextSuggestionChips}
              onActivate={handleChipActivate}
              layout="inline"
              emphasis="cta"
            />
          )}
          {assistantCtx?.inbox?.emailConnected && (
            <button
              type="button"
              className="kimchi-suggest-trigger"
              disabled={inboxScanning}
              onClick={() => void scanInboxWithAi()}
            >
              {inboxScanning ? "Checking email…" : "✦ Check email for job updates"}
            </button>
          )}
          {canGenerateNextSteps && !nextStepsVisible && (
            <button
              type="button"
              className="kimchi-suggest-trigger"
              onClick={() => generateNextSteps()}
            >
              ✦ Next from this chat
            </button>
          )}
          {nextStepsVisible && followUpChips.length > 0 && (
            <>
              <KimchiAssistantChipRow
                chips={followUpChips.slice(0, 5)}
                onActivate={handleChipActivate}
                layout="inline"
                emphasis="cta"
              />
              {canAskAiSuggestions && (
                <button
                  type="button"
                  className="kimchi-ai-suggest-btn"
                  disabled={followUpAiLoading}
                  onClick={() => void loadAiFollowUpChips()}
                >
                  {followUpAiLoading ? "Personalizing…" : "✦ Personalized follow-ups"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!voiceUnavailable && voiceAvailable !== false && (
        <div className="kimchi-chat-panel__voice-bar">
          {sessionActive ? (
            <>
              <VoiceOrb
                variant="composer"
                state={orbState}
                audioLevel={audioLevel}
                onClick={toggleSession}
                disabled={!agentSettings}
              />
              <div className="kimchi-chat-panel__voice-status">
                <span className="kimchi-chat-panel__voice-label">
                  {getVoicePreset(selectedPreset).emoji}{" "}
                  {orbState === "listening" || orbState === "live"
                    ? "Listening…"
                    : orbState === "speaking"
                      ? "Kimchi is speaking"
                      : orbState === "connecting"
                        ? "Connecting…"
                        : orbState === "thinking"
                          ? "Thinking…"
                          : "Talking"}
                </span>
                {transcriptLines.length === 0 &&
                  (orbState === "live" || orbState === "listening" || orbState === "connecting") && (
                    <span className="kimchi-chat-panel__voice-hint">Just start speaking — Kimchi is listening.</span>
                  )}
              </div>
              <button type="button" className="kimchi-voice-done-btn" onClick={endSession}>
                Done talking
              </button>
              {voiceError && <span className="kimchi-chat-panel__voice-error">{voiceError}</span>}
            </>
          ) : presetMenuOpen ? (
            <div className="kimchi-preset-menu">
              {VOICE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="kimchi-preset-menu__item"
                  style={{ borderLeftColor: p.accent, borderLeftWidth: 3, borderLeftStyle: "solid" }}
                  onClick={() => startPresetVoice(p.id)}
                >
                  <span className="kimchi-preset-menu__emoji" aria-hidden="true">{p.emoji}</span>
                  <span className="kimchi-preset-menu__copy">
                    <span className="kimchi-preset-menu__title">{p.title}</span>
                    <span className="kimchi-preset-menu__desc">{p.description}</span>
                  </span>
                </button>
              ))}
              <button type="button" className="kimchi-preset-menu__cancel" onClick={() => setPresetMenuOpen(false)}>
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="kimchi-chat-panel__composer">
        {messages.some((m) => m.kind === "text" || !m.kind) && (
          <div className="kimchi-composer-toolbar">
            <KimchiCopyButton
              text={formatThreadForCopy(messages)}
              label="Copy chat"
              className="kimchi-copy-btn--thread"
            />
            <span className="kimchi-composer-toolbar__hint">Copy chat</span>
          </div>
        )}
        <div className="kimchi-composer-box">
          {!voiceUnavailable && voiceAvailable !== false && !sessionActive && (
            <div className="kimchi-composer-box__toolbar">
              <button type="button" className="kimchi-composer-box__talk" onClick={() => setPresetMenuOpen((v) => !v)}>
                <span className="kimchi-composer-box__talk-icon" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" fill="currentColor" />
                    <path
                      d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-1.08A7 7 0 0 0 19 11Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                Talk it out
                <span className="kimchi-composer-box__talk-chev" aria-hidden="true">▾</span>
              </button>
            </div>
          )}
          <div className="kimchi-composer-box__input-wrap">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Message Kimchi…"
              rows={2}
              disabled={streaming}
              className="kimchi-composer-box__input"
            />
            <button
              type="button"
              className="kimchi-composer-box__send"
              disabled={!input.trim() || streaming}
              onClick={() => void sendMessage(input)}
              aria-label="Send"
            >
              ↑
            </button>
          </div>
        </div>
      </div>

      <CreditsInlineHint />

      {showUpgrade && (
        <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}

      <KimchiTranscriptModal
        open={!!transcriptModal}
        title={transcriptModal?.title ?? ""}
        transcript={transcriptModal?.body ?? ""}
        onClose={() => setTranscriptModal(null)}
      />

      <KimchiEmailInsightDrawer
        open={!!insightActivityId}
        activityId={insightActivityId}
        inbox={assistantCtx?.inbox ?? null}
        pipelineJobs={pipelineJobs}
        onClose={() => setInsightActivityId(null)}
        onAskKimchi={(prompt) => void sendMessage(prompt)}
        onRefreshInbox={loadContext}
      />

      <KimchiSaveIntakeModal
        open={!!saveIntakeModal}
        excerpt={saveIntakeModal?.excerpt ?? ""}
        presetTitle={saveIntakeModal?.presetTitle ?? "Voice chat"}
        onClose={() => setSaveIntakeModal(null)}
        onGenerateStrategy={() => {
          setSaveIntakeModal(null);
          setStrategyModalOpen(true);
        }}
      />

      <KimchiStrategyGenerateModal open={strategyModalOpen} onClose={() => setStrategyModalOpen(false)} />

      {resumeAssetId && (
        <ProfileResumeEditor
          open={resumeEditorOpen}
          assetId={resumeAssetId}
          onClose={() => {
            setResumeEditorOpen(false);
            setResumeAssetId(null);
          }}
          initialJobDescription={resumeContextNotes}
        />
      )}

      <KimchiChatPanelStyles />
    </div>
  );
}

function KimchiChatPanelStyles() {
  return (
    <style>{`
      .kimchi-chat-panel {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        background: #FAFAF8;
        position: relative;
      }
      .kimchi-chat-panel__thread {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .kimchi-msg-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 18px;
        max-width: 100%;
      }
      .kimchi-msg-row--user {
        justify-content: flex-end;
      }
      .kimchi-msg-body {
        min-width: 0;
        max-width: min(88%, 560px);
      }
      .kimchi-msg-row--user .kimchi-msg-body {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .kimchi-msg-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 4px 2px;
        min-height: 28px;
      }
      .kimchi-msg-sender {
        font-family: ${sans};
        font-size: 12px;
        font-weight: 700;
        color: rgba(26, 58, 47, 0.55);
      }
      .kimchi-msg-sender--user {
        margin-left: auto;
      }
      .kimchi-msg-row--user .kimchi-msg-meta {
        justify-content: flex-end;
      }
      .kimchi-msg-avatar {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: ${sans};
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
      }
      .kimchi-msg-avatar--kimchi {
        background: linear-gradient(135deg, #E8913A 0%, #D45D7A 100%);
        color: #fff;
        font-size: 14px;
      }
      .kimchi-msg-avatar--user {
        background: #3b82c4;
        color: #fff;
      }
      .kimchi-chat-bubble {
        width: 100%;
        margin-bottom: 0;
        padding: 14px 16px;
        border-radius: 14px;
        font-family: ${sans};
        font-size: 15px;
        line-height: 1.6;
      }
      .kimchi-chat-bubble--user {
        background: #1A3A2F;
        color: #F5F0E6;
        white-space: pre-wrap;
        border-bottom-right-radius: 4px;
      }
      .kimchi-chat-bubble--assistant {
        background: #FFFFFF;
        color: #1A1A1A;
        border: 1px solid rgba(26, 58, 47, 0.08);
        box-shadow: 0 1px 3px rgba(17, 17, 17, 0.04);
        border-bottom-left-radius: 4px;
      }
      .kimchi-message-actions {
        max-width: 100%;
        margin: -6px 0 16px 44px;
      }
      .kimchi-suggestions-bar {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 16px 6px;
        border-top: 1px solid rgba(26, 58, 47, 0.06);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 248, 235, 0.45) 100%);
      }
      .kimchi-suggest-trigger {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border: 1px solid rgba(26, 58, 47, 0.14);
        border-radius: 10px;
        background: #fff;
        font-family: ${sans};
        font-size: 12px;
        font-weight: 600;
        color: rgba(26, 58, 47, 0.72);
        cursor: pointer;
        transition: background 0.12s ease, border-color 0.12s ease;
      }
      .kimchi-suggest-trigger:hover:not(:disabled) {
        background: rgba(26, 58, 47, 0.04);
        border-color: rgba(26, 58, 47, 0.22);
        color: #1A3A2F;
      }
      .kimchi-ai-suggest-btn {
        display: inline-flex;
        margin-top: 8px;
        padding: 0;
        border: none;
        background: none;
        font-family: ${sans};
        font-size: 11px;
        font-weight: 600;
        color: rgba(26, 58, 47, 0.48);
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .kimchi-ai-suggest-btn:hover:not(:disabled) {
        color: #1A3A2F;
      }
      .kimchi-ai-suggest-btn:disabled {
        opacity: 0.6;
        cursor: wait;
      }
      .kimchi-composer-toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
      }
      .kimchi-composer-toolbar__hint {
        font-family: ${sans};
        font-size: 11px;
        font-weight: 600;
        color: rgba(26, 58, 47, 0.42);
      }
      .kimchi-copy-btn--thread {
        width: 30px;
        height: 30px;
      }
      .kimchi-chat-bubble--assistant p { margin: 0 0 8px; }
      .kimchi-chat-bubble--assistant p:last-child { margin-bottom: 0; }
      .kimchi-chat-bubble--assistant strong {
        font-size: 17px;
        font-weight: 700;
        color: #1A3A2F;
      }
      .kimchi-voice-block {
        margin-bottom: 14px;
        padding: 14px;
        background: rgba(26, 58, 47, 0.04);
        border: 1px solid rgba(26, 58, 47, 0.1);
        border-radius: var(--scout-radius);
      }
      .kimchi-voice-block__eyebrow {
        margin: 0 0 6px;
        font-family: ${sans};
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(26, 58, 47, 0.55);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .kimchi-voice-block__emoji {
        font-size: 14px;
        line-height: 1;
        text-transform: none;
        letter-spacing: 0;
      }
      .kimchi-voice-block__summary {
        margin: 0;
        font-family: ${sans};
        font-size: 14px;
        line-height: 1.5;
        color: #1A1A1A;
      }
      .kimchi-voice-block__bullets {
        margin: 8px 0 0;
        padding-left: 18px;
        font-family: ${sans};
        font-size: 13px;
        line-height: 1.45;
      }
      .kimchi-voice-block__actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 12px;
      }
      .kimchi-voice-block__actions button {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        padding: 10px 12px;
        background: #1A3A2F;
        color: #E8D5A3;
        border: none;
        border-radius: var(--scout-radius);
        font-family: ${sans};
        cursor: pointer;
        text-align: left;
      }
      .kimchi-voice-block__action-label {
        font-size: 13px;
        font-weight: 600;
      }
      .kimchi-voice-block__action-hint {
        font-size: 11px;
        font-weight: 400;
        opacity: 0.75;
        line-height: 1.35;
      }
      .kimchi-voice-done-btn {
        margin-left: auto;
        padding: 7px 12px;
        background: rgba(26, 58, 47, 0.08);
        border: 1px solid rgba(26, 58, 47, 0.18);
        border-radius: 999px;
        font-family: ${sans};
        font-size: 12px;
        font-weight: 600;
        color: #1A3A2F;
        cursor: pointer;
        flex-shrink: 0;
      }
      .kimchi-voice-done-btn:hover {
        background: rgba(26, 58, 47, 0.12);
      }
      .kimchi-voice-block__transcript {
        display: inline-block;
        margin-top: 10px;
        padding: 0;
        border: none;
        background: none;
        font-family: ${sans};
        font-size: 12px;
        color: rgba(26, 58, 47, 0.6);
        cursor: pointer;
        text-decoration: underline;
      }
      .kimchi-chat-panel__voice-bar {
        padding: 10px 18px;
        border-top: 1px solid rgba(0,0,0,0.06);
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .kimchi-chat-panel__voice-status {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .kimchi-chat-panel__voice-label {
        font-family: ${sans};
        font-size: 13px;
        color: var(--scout-muted);
      }
      .kimchi-chat-panel__voice-hint {
        font-family: ${sans};
        font-size: 12px;
        line-height: 1.35;
        color: rgba(26, 58, 47, 0.55);
      }
      .kimchi-chat-panel__voice-error {
        font-family: ${sans};
        font-size: 12px;
        color: #9B3A2A;
      }
      .kimchi-preset-menu {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
      }
      .kimchi-preset-menu__item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        text-align: left;
        padding: 10px 12px;
        background: #fff;
        border: 1px solid rgba(26, 58, 47, 0.12);
        border-radius: var(--scout-radius);
        cursor: pointer;
      }
      .kimchi-preset-menu__item:hover {
        background: rgba(26, 58, 47, 0.04);
      }
      .kimchi-preset-menu__emoji {
        font-size: 20px;
        line-height: 1.2;
        flex-shrink: 0;
      }
      .kimchi-preset-menu__copy {
        min-width: 0;
      }
      .kimchi-preset-menu__title {
        display: block;
        font-family: ${sans};
        font-size: 14px;
        font-weight: 600;
        color: #1A3A2F;
      }
      .kimchi-preset-menu__desc {
        display: block;
        margin-top: 2px;
        font-family: ${sans};
        font-size: 12px;
        color: var(--scout-muted);
        line-height: 1.35;
      }
      .kimchi-preset-menu__cancel {
        margin-top: 4px;
        padding: 6px;
        border: none;
        background: none;
        font-family: ${sans};
        font-size: 12px;
        color: rgba(26, 58, 47, 0.55);
        cursor: pointer;
      }
      .kimchi-chat-panel__composer {
        padding: 14px 20px 18px;
        border-top: 1px solid rgba(0,0,0,0.06);
        background: #FFFFFF;
        flex-shrink: 0;
      }
      .kimchi-composer-box {
        border: 1.5px solid rgba(26, 58, 47, 0.1);
        border-radius: 16px;
        background: #FAFAF8;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(17, 17, 17, 0.04);
      }
      .kimchi-composer-box__toolbar {
        padding: 8px 10px 0;
        border-bottom: 1px solid rgba(26, 58, 47, 0.06);
      }
      .kimchi-composer-box__talk {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 8px;
        padding: 7px 12px;
        background: rgba(26, 58, 47, 0.06);
        border: 1px solid rgba(26, 58, 47, 0.12);
        border-radius: 999px;
        font-family: ${sans};
        font-size: 13px;
        font-weight: 600;
        color: #1A3A2F;
        cursor: pointer;
      }
      .kimchi-composer-box__talk-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1A3A2F;
      }
      .kimchi-composer-box__talk-chev {
        font-size: 9px;
        color: rgba(26, 58, 47, 0.5);
      }
      .kimchi-composer-box__input-wrap {
        position: relative;
        display: flex;
        align-items: flex-end;
      }
      .kimchi-composer-box__input {
        flex: 1;
        min-height: 72px;
        max-height: 180px;
        resize: none;
        border: none;
        padding: 12px 52px 12px 14px;
        font-family: ${sans};
        font-size: 15px;
        line-height: 1.45;
        outline: none;
        background: transparent;
      }
      .kimchi-composer-box__send {
        position: absolute;
        right: 10px;
        bottom: 10px;
        width: 36px;
        height: 36px;
        border: none;
        border-radius: var(--scout-radius);
        background: #1A3A2F;
        color: #E8D5A3;
        font-size: 17px;
        cursor: pointer;
      }
      .kimchi-composer-box__send:disabled {
        background: rgba(26, 58, 47, 0.08);
        color: rgba(26, 58, 47, 0.35);
        cursor: default;
      }
    `}</style>
  );
}
