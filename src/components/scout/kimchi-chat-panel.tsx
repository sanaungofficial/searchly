"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useVoiceAgentSession, type VoiceAgentSessionResult } from "@/hooks/use-voice-agent-session";
import type { useKimchiThreads } from "@/hooks/use-kimchi-threads";
import type { DebriefAction } from "@/lib/kimchi-assistant/debrief";
import type { StoredThreadMessage } from "@/lib/kimchi-assistant/thread-serialize";
import type {
  AssistantContextPayload,
  AssistantPageHint,
  AssistantSuggestion,
} from "@/lib/kimchi-assistant/types";
import { VOICE_PRESETS, getVoicePreset, type VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";
import { ProfileResumeEditor } from "@/components/scout/profile-resume-editor";
import { CreditsInlineHint } from "@/components/scout/credits-display";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { notifyCreditsChanged } from "@/lib/credits";
import { fontSans } from "@/lib/typography";
import { useWorkspace } from "@/contexts/workspace-context";
import { STAGE_LABELS } from "./workspace-data";
import {
  KimchiDoNextStrip,
  KimchiDoNextCollapsedStyles,
  KimchiEmailInsightDrawer,
  KimchiSaveIntakeModal,
  KimchiStrategyGenerateModal,
  KimchiTranscriptModal,
} from "@/components/scout/kimchi-chat-extras";
import { VoiceOrb } from "@/components/voice/voice-orb";

const sans = fontSans;

type VoiceMessage = StoredThreadMessage & {
  kind: "voice";
  debriefLoading?: boolean;
};

type Props = {
  pageHint?: AssistantPageHint;
  voiceUnavailable?: boolean;
  threads: ReturnType<typeof useKimchiThreads>;
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

export function KimchiChatPanel({ pageHint, voiceUnavailable, threads }: Props) {
  const { openPricing, kanbanCards } = useWorkspace();
  const { messages, setMessages, ensureThread, updateLastAssistant, persistMessages } = threads;

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [assistantCtx, setAssistantCtx] = useState<AssistantContextPayload | null>(null);
  const [doNextCollapsed, setDoNextCollapsed] = useState(false);
  const [doNextForceOpen, setDoNextForceOpen] = useState(false);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<VoicePresetId>("general");
  const [transcriptModal, setTranscriptModal] = useState<{ title: string; body: string } | null>(null);
  const [insightActivityId, setInsightActivityId] = useState<string | null>(null);
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [resumeAssetId, setResumeAssetId] = useState<string | null>(null);
  const [resumeContextNotes, setResumeContextNotes] = useState<string | null>(null);
  const [saveIntakeModal, setSaveIntakeModal] = useState<{ excerpt: string; presetTitle: string } | null>(null);
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activePresetRef = useRef<VoicePresetId>("general");
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
          body: JSON.stringify({ presetId, transcript: result.transcript }),
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
    [ensureThread, setMessages, threads],
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
    toggleSession,
    agentSettings,
  } = useVoiceAgentSession({
    context: "workspace",
    voicePresetId: selectedPreset,
    pageHint,
    disabled: voiceUnavailable,
    onComplete: onVoiceComplete,
  });

  useEffect(() => {
    if (pendingVoiceStart && agentSettings && !sessionActive) {
      setPendingVoiceStart(false);
      toggleSession();
    }
  }, [pendingVoiceStart, agentSettings, sessionActive, toggleSession]);

  const loadContext = useCallback(() => {
    void fetch(`/api/assistant/context${contextQuery(pageHint)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAssistantCtx(data as AssistantContextPayload);
      })
      .catch(() => {});
  }, [pageHint]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (input.trim().length > 0) setDoNextCollapsed(true);
  }, [input]);

  const suggestions = assistantCtx?.suggestions ?? [];
  const showDoNext = suggestions.length > 0 && (!doNextCollapsed || doNextForceOpen);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

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
    setDoNextCollapsed(true);

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
      notifyCreditsChanged();
      if (threadId && accumulated.trim()) {
        void persistMessages(threadId, [{ kind: "text", role: "assistant", content: accumulated }]);
      }
    } catch {
      updateLastAssistant("Couldn't reach Kimchi — check your connection.");
    } finally {
      setStreaming(false);
    }
  };

  const handleDoNextSelect = (s: AssistantSuggestion) => {
    if (s.kind === "inbox_email" && s.meta?.activityId) {
      setInsightActivityId(s.meta.activityId);
      return;
    }
    if (s.kind === "follow_up") {
      void sendMessage(`Help me follow up: ${s.title} — ${s.detail}`);
      return;
    }
    if (s.route) {
      void sendMessage(`Help me with: ${s.title} — ${s.detail}`);
      return;
    }
    void sendMessage(s.title);
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
      const res = await fetch("/api/assets");
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
    setDoNextCollapsed(true);
    setPendingVoiceStart(true);
  };

  return (
    <div className="kimchi-chat-panel">
      {showDoNext ? (
        <KimchiDoNextStrip
          suggestions={suggestions}
          collapsed={false}
          onExpand={() => setDoNextForceOpen(true)}
          onSelect={handleDoNextSelect}
        />
      ) : doNextCollapsed && suggestions.length > 0 ? (
        <>
          <KimchiDoNextStrip
            suggestions={suggestions}
            collapsed
            onExpand={() => {
              setDoNextCollapsed(false);
              setDoNextForceOpen(true);
            }}
            onSelect={handleDoNextSelect}
          />
          <KimchiDoNextCollapsedStyles />
        </>
      ) : null}

      <div className="kimchi-chat-panel__thread">
        {messages.map((msg, i) => {
          if (msg.kind === "voice") {
            const vm = msg as VoiceMessage;
            return (
              <div key={msg.id ?? `voice-${i}`} className="kimchi-voice-block">
                <p className="kimchi-voice-block__eyebrow">Voice · {vm.presetTitle}</p>
                <p className="kimchi-voice-block__summary">{vm.summary}</p>
                {vm.bullets.length > 0 && (
                  <ul className="kimchi-voice-block__bullets">
                    {vm.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {!vm.debriefLoading && vm.actions.length > 0 && (
                  <div className="kimchi-voice-block__actions">
                    {vm.actions.map((a) => (
                      <button key={a.id} type="button" onClick={() => void handleDebriefAction(vm, a)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
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
          return (
            <div
              key={msg.id ?? `t-${i}-${msg.content.slice(0, 12)}`}
              className={`kimchi-chat-bubble kimchi-chat-bubble--${msg.role}`}
            >
              {msg.role === "user" ? (
                msg.content
              ) : (
                <ReactMarkdown>
                  {msg.content || (streaming && i === messages.length - 1 ? "…" : "")}
                </ReactMarkdown>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

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
              <span className="kimchi-chat-panel__voice-label">
                {orbState === "listening" ? "Listening…" : orbState === "speaking" ? "Kimchi is speaking" : "Tap orb when done"}
              </span>
              {voiceError && <span className="kimchi-chat-panel__voice-error">{voiceError}</span>}
            </>
          ) : presetMenuOpen ? (
            <div className="kimchi-preset-menu">
              {VOICE_PRESETS.map((p) => (
                <button key={p.id} type="button" className="kimchi-preset-menu__item" onClick={() => startPresetVoice(p.id)}>
                  <span className="kimchi-preset-menu__title">{p.title}</span>
                  <span className="kimchi-preset-menu__desc">{p.description}</span>
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
        {!voiceUnavailable && voiceAvailable !== false && !sessionActive && (
          <button type="button" className="kimchi-chat-panel__talk-btn" onClick={() => setPresetMenuOpen((v) => !v)}>
            Talk it out ▾
          </button>
        )}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setDoNextCollapsed(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(input);
            }
          }}
          placeholder="Type a message…"
          rows={3}
          disabled={streaming}
          className="kimchi-chat-panel__input"
        />
        <button
          type="button"
          className="kimchi-chat-panel__send"
          disabled={!input.trim() || streaming}
          onClick={() => void sendMessage(input)}
          aria-label="Send"
        >
          ↑
        </button>
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
        background: #fff;
        position: relative;
      }
      .kimchi-chat-panel__thread {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 16px 18px;
      }
      .kimchi-chat-bubble {
        max-width: 92%;
        margin-bottom: 12px;
        padding: 12px 14px;
        border-radius: var(--scout-radius);
        font-family: ${sans};
        font-size: 14px;
        line-height: 1.55;
      }
      .kimchi-chat-bubble--user {
        margin-left: auto;
        background: #1A3A2F;
        color: #E8D5A3;
        white-space: pre-wrap;
      }
      .kimchi-chat-bubble--assistant {
        background: rgba(26, 58, 47, 0.06);
        color: #1A1A1A;
      }
      .kimchi-chat-bubble--assistant p { margin: 0 0 6px; }
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
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .kimchi-voice-block__actions button {
        padding: 9px 12px;
        background: #1A3A2F;
        color: #E8D5A3;
        border: none;
        border-radius: var(--scout-radius);
        font-family: ${sans};
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
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
      .kimchi-chat-panel__voice-label {
        font-family: ${sans};
        font-size: 13px;
        color: var(--scout-muted);
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
        text-align: left;
        padding: 10px 12px;
        background: #fff;
        border: 1px solid rgba(26, 58, 47, 0.12);
        border-radius: var(--scout-radius);
        cursor: pointer;
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
        display: flex;
        align-items: flex-end;
        gap: 10px;
        padding: 12px 18px 16px;
        border-top: 1px solid rgba(0,0,0,0.06);
        flex-shrink: 0;
      }
      .kimchi-chat-panel__talk-btn {
        flex-shrink: 0;
        padding: 12px 14px;
        background: rgba(26, 58, 47, 0.06);
        border: 1px solid rgba(26, 58, 47, 0.14);
        border-radius: var(--scout-radius);
        font-family: ${sans};
        font-size: 12px;
        font-weight: 600;
        color: #1A3A2F;
        cursor: pointer;
        white-space: nowrap;
      }
      .kimchi-chat-panel__input {
        flex: 1;
        min-height: 88px;
        max-height: 200px;
        resize: vertical;
        border: 1px solid rgba(26, 58, 47, 0.14);
        border-radius: var(--scout-radius);
        padding: 12px 14px;
        font-family: ${sans};
        font-size: 14px;
        line-height: 1.45;
        outline: none;
      }
      .kimchi-chat-panel__send {
        width: 44px;
        height: 44px;
        flex-shrink: 0;
        border: none;
        border-radius: var(--scout-radius);
        background: #1A3A2F;
        color: #E8D5A3;
        font-size: 18px;
        cursor: pointer;
        align-self: flex-end;
      }
      .kimchi-chat-panel__send:disabled {
        background: rgba(26, 58, 47, 0.08);
        color: rgba(26, 58, 47, 0.35);
        cursor: default;
      }
    `}</style>
  );
}
