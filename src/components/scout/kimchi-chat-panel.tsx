"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useVoiceAgentSession, type VoiceAgentSessionResult } from "@/hooks/use-voice-agent-session";
import type { DebriefAction } from "@/lib/kimchi-assistant/debrief";
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
  KimchiInboxPeekModal,
  KimchiTranscriptModal,
} from "@/components/scout/kimchi-chat-extras";
import { VoiceOrb } from "@/components/voice/voice-orb";

const sans = fontSans;

type TextMessage = { kind: "text"; role: "user" | "assistant"; content: string };
type VoiceMessage = {
  kind: "voice";
  presetId: VoicePresetId;
  presetTitle: string;
  summary: string;
  bullets: string[];
  actions: DebriefAction[];
  rawTranscript: string;
  debriefLoading?: boolean;
};

type ThreadMessage = TextMessage | VoiceMessage;

type Props = {
  pageHint?: AssistantPageHint;
  voiceUnavailable?: boolean;
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

export function KimchiChatPanel({ pageHint, voiceUnavailable }: Props) {
  const { openPricing, kanbanCards } = useWorkspace();
  const [messages, setMessages] = useState<ThreadMessage[]>([
    {
      kind: "text",
      role: "assistant",
      content: "Ask anything about your search — or tap **Talk it out** to use your voice. I'll pick up from there.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [assistantCtx, setAssistantCtx] = useState<AssistantContextPayload | null>(null);
  const [doNextCollapsed, setDoNextCollapsed] = useState(false);
  const [doNextForceOpen, setDoNextForceOpen] = useState(false);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<VoicePresetId>("general");
  const [transcriptModal, setTranscriptModal] = useState<{ title: string; body: string } | null>(null);
  const [inboxPeekOpen, setInboxPeekOpen] = useState(false);
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [resumeAssetId, setResumeAssetId] = useState<string | null>(null);
  const [resumeContextNotes, setResumeContextNotes] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activePresetRef = useRef<VoicePresetId>("general");
  const [pendingVoiceStart, setPendingVoiceStart] = useState(false);

  const runDebrief = useCallback(async (presetId: VoicePresetId, result: VoiceAgentSessionResult) => {
    const preset = getVoicePreset(presetId);
    const placeholderId = `voice-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        kind: "voice",
        presetId,
        presetTitle: preset.title,
        summary: "Summarizing what you said…",
        bullets: [],
        actions: [],
        rawTranscript: result.transcript,
        debriefLoading: true,
      },
    ]);

    try {
      const res = await fetch("/api/assistant/voice-debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId, transcript: result.transcript }),
      });
      const data = res.ok ? await res.json() : null;
      setMessages((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex((m) => m.kind === "voice" && m.debriefLoading);
        if (idx === -1) return prev;
        copy[idx] = {
          kind: "voice",
          presetId,
          presetTitle: preset.title,
          summary: data?.summary ?? result.summary,
          bullets: data?.bullets ?? [],
          actions: data?.actions ?? [],
          rawTranscript: result.transcript,
        };
        return copy;
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === "voice" && m.debriefLoading
            ? {
                ...m,
                debriefLoading: false,
                summary: result.summary || "Voice chat saved — ask me to recap anytime.",
              }
            : m,
        ),
      );
    }
  }, []);

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
    resetSession,
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

    const textThread = messages.filter((m): m is TextMessage => m.kind === "text");
    const nextMessages = [...textThread, { role: "user" as const, content: trimmed }];
    setMessages((prev) => [...prev, { kind: "text", role: "user", content: trimmed }, { kind: "text", role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setDoNextCollapsed(true);

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
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.kind === "text") last.content = "That didn't work — try again.";
          return copy;
        });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snap = accumulated;
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.kind === "text" && last.role === "assistant") last.content = snap;
          return copy;
        });
      }
      notifyCreditsChanged();
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.kind === "text") last.content = "Couldn't reach Kimchi — check your connection.";
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleDoNextSelect = (s: AssistantSuggestion) => {
    if (s.kind === "inbox_email" || s.kind === "follow_up") {
      setInboxPeekOpen(true);
      return;
    }
    if (s.route) {
      void sendMessage(`Help me with: ${s.title} — ${s.detail}`);
      return;
    }
    void sendMessage(s.title);
  };

  const handleDebriefAction = async (msg: VoiceMessage, action: DebriefAction) => {
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
    if (action.type === "save_strategy_notes") {
      const block = `[Voice · ${msg.presetTitle} · ${new Date().toISOString()}]\n${msg.summary}\n\n${msg.rawTranscript.slice(0, 8000)}`;
      const profileRes = await fetch("/api/profile");
      const profileData = profileRes.ok ? await profileRes.json() : null;
      const existing = profileData?.strategyIntakeNotes?.trim() ?? "";
      const merged = existing ? `${existing}\n\n---\n\n${block}` : block;
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyIntakeNotes: merged.slice(0, 24000) }),
      });
      setMessages((prev) => [
        ...prev,
        { kind: "text", role: "assistant", content: "Saved to your notes. You can edit anytime on Profile." },
      ]);
      return;
    }
    if (action.type === "open_inbox_peek") {
      setInboxPeekOpen(true);
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

  const visibleMessages = messages.slice(-2);

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
        {visibleMessages.length < messages.length && (
          <button
            type="button"
            className="kimchi-chat-panel__older"
            onClick={() =>
              setTranscriptModal({
                title: "Full conversation",
                body: messages
                  .map((m) => {
                    if (m.kind === "text") return `${m.role === "user" ? "You" : "Kimchi"}: ${m.content}`;
                    return `[Voice · ${m.presetTitle}]\n${m.summary}\n${m.rawTranscript}`;
                  })
                  .join("\n\n"),
              })
            }
          >
            {messages.length - visibleMessages.length} earlier message{messages.length - visibleMessages.length === 1 ? "" : "s"} · View all
          </button>
        )}

        {visibleMessages.map((msg, i) => {
          if (msg.kind === "voice") {
            return (
              <div key={`voice-${i}`} className="kimchi-voice-block">
                <p className="kimchi-voice-block__eyebrow">Voice · {msg.presetTitle}</p>
                <p className="kimchi-voice-block__summary">{msg.summary}</p>
                {msg.bullets.length > 0 && (
                  <ul className="kimchi-voice-block__bullets">
                    {msg.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {!msg.debriefLoading && msg.actions.length > 0 && (
                  <div className="kimchi-voice-block__actions">
                    {msg.actions.map((a) => (
                      <button key={a.id} type="button" onClick={() => void handleDebriefAction(msg, a)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="kimchi-voice-block__transcript"
                  onClick={() =>
                    setTranscriptModal({ title: `Transcript · ${msg.presetTitle}`, body: msg.rawTranscript })
                  }
                >
                  View full transcript
                </button>
              </div>
            );
          }
          return (
            <div
              key={`t-${i}-${msg.content.slice(0, 12)}`}
              className={`kimchi-chat-bubble kimchi-chat-bubble--${msg.role}`}
            >
              {msg.role === "user" ? (
                msg.content
              ) : (
                <ReactMarkdown>{msg.content || (streaming && i === visibleMessages.length - 1 ? "…" : "")}</ReactMarkdown>
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
          rows={1}
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

      <KimchiInboxPeekModal
        open={inboxPeekOpen}
        inbox={assistantCtx?.inbox ?? null}
        onClose={() => setInboxPeekOpen(false)}
      />

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
      }
      .kimchi-chat-panel__thread {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 12px 14px;
      }
      .kimchi-chat-panel__older {
        display: block;
        width: 100%;
        margin: 0 0 10px;
        padding: 0;
        border: none;
        background: none;
        font-family: ${sans};
        font-size: 12px;
        color: rgba(26, 58, 47, 0.55);
        text-align: center;
        cursor: pointer;
        text-decoration: underline;
      }
      .kimchi-chat-bubble {
        max-width: 92%;
        margin-bottom: 10px;
        padding: 10px 12px;
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
        margin-bottom: 12px;
        padding: 12px;
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
        gap: 6px;
        margin-top: 10px;
      }
      .kimchi-voice-block__actions button {
        padding: 8px 10px;
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
        margin-top: 8px;
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
        padding: 8px 14px;
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
        gap: 8px;
        padding: 10px 14px 12px;
        border-top: 1px solid rgba(0,0,0,0.06);
        flex-shrink: 0;
      }
      .kimchi-chat-panel__talk-btn {
        flex-shrink: 0;
        padding: 10px 12px;
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
        min-height: 40px;
        max-height: 100px;
        resize: none;
        border: 1px solid rgba(26, 58, 47, 0.14);
        border-radius: var(--scout-radius);
        padding: 10px 12px;
        font-family: ${sans};
        font-size: 14px;
        line-height: 1.45;
        outline: none;
      }
      .kimchi-chat-panel__send {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border: none;
        border-radius: var(--scout-radius);
        background: #1A3A2F;
        color: #E8D5A3;
        font-size: 16px;
        cursor: pointer;
      }
      .kimchi-chat-panel__send:disabled {
        background: rgba(26, 58, 47, 0.08);
        color: rgba(26, 58, 47, 0.35);
        cursor: default;
      }
    `}</style>
  );
}
