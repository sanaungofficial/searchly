"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useWorkspace } from "@/contexts/workspace-context";
import { STAGE_LABELS, type KanbanCard } from "./workspace-data";
import type { JobMeta } from "@/lib/job-meta";
import { resolveJobDescriptionText } from "@/lib/job-meta";
import type { DrawerTool } from "./workspace-opportunities";
import { fontSans, color } from "@/lib/typography";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { CreditCostBadge, CreditsInlineHint, CreditsStatusBar } from "@/components/scout/credits-display";
import { ScoreExplainerPopover } from "@/components/scout/score-explainer-popover";
import { notifyCreditsChanged } from "@/lib/credits";
import { pipelineJobUrl } from "@/lib/workspace-urls";
import { KimchiComposerRow, KimchiVoiceComposerFooter, type KimchiVoiceProps } from "@/components/scout/kimchi-composer";
import { useIsMobile } from "@/hooks/use-mobile";

const sans = fontSans;

type ChatMessage = { role: "user" | "assistant"; content: string };

const FIT_SUGGESTIONS = [
  "Am I actually a fit for this role?",
  "Where am I weakest?",
  "What would make my app stand out?",
  "What should I lead with in an interview?",
];

const FIT_STARTERS_NO_RESUME = [
  "What would I need to qualify for this role?",
  "Help me figure out if this job fits me",
  "What should I put on my resume for this?",
  "What experience should I highlight?",
];

const FIT_FOLLOWUP_QUESTIONS = [
  "What are my biggest gaps?",
  "How can I stand out?",
  "What should I say in an interview?",
  "What skills should I learn first?",
];

const COACH_PREP_SUGGESTIONS = [
  "What should I ask about their track record?",
  "How do I open without wasting time?",
  "What should I walk away with?",
  "Is this coach worth my time?",
];

function fitWelcomeMessage(job: KanbanCard): string {
  const fitNote = job.fit > 0 ? ` Resume match: ${job.fit}%.` : "";
  return `Let's look at your fit for ${job.role} at ${job.company}.${fitNote} I'll be straight about strengths, gaps, and what to do about them — pick a suggestion or ask anything.`;
}

function coachPrepWelcomeMessage(coachName: string, matchScore?: number, matchLabel?: string): string {
  const matchNote =
    matchScore && matchScore > 0 ? ` Profile match: ${matchLabel ?? "Match"} (${matchScore}/100).` : "";
  return `Let's prep for your session with ${coachName}.${matchNote} I can help you figure out what to ask, what to share, and whether this is worth your time — pick a suggestion or ask anything.`;
}

function ChatMessageBody({
  role,
  content,
  streaming,
}: {
  role: ChatMessage["role"];
  content: string;
  streaming?: boolean;
}) {
  if (!content) {
    return streaming ? <>…</> : null;
  }

  if (role === "user") {
    return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
  }

  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p style={{ margin: "0 0 8px", lineHeight: 1.55 }}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong style={{ fontWeight: 600, color: "#1A1A1A" }}>{children}</strong>
        ),
        ul: ({ children }) => (
          <ul style={{ margin: "0 0 8px", paddingLeft: 18, lineHeight: 1.5 }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: "0 0 8px", paddingLeft: 18, lineHeight: 1.5 }}>{children}</ol>
        ),
        li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
        h1: ({ children }) => (
          <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 15 }}>{children}</p>
        ),
        h2: ({ children }) => (
          <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14 }}>{children}</p>
        ),
        h3: ({ children }) => (
          <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: 14 }}>{children}</p>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function ChatWidget({
  hideLauncher = false,
  embedded = false,
  unified = false,
  voice,
  bottomStackOffset = 0,
}: {
  hideLauncher?: boolean;
  embedded?: boolean;
  unified?: boolean;
  voice?: KimchiVoiceProps;
  bottomStackOffset?: number;
}) {
  const router = useRouter();
  const {
    kanbanCards,
    drawerCardId,
    setDrawerCardId,
    setDrawerTool,
    chatOpen,
    setChatOpen,
    chatView,
    setChatView,
    chatPulse,
    fitChatNonce,
    fitChatJob,
    openFitChat,
    openPricing,
    coachChatNonce,
    openProfileCoach,
    coachPrepCoach,
    coachPrepNonce,
    openCoachPrepChat,
  } = useWorkspace();

  const isMobile = useIsMobile();
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [coachMessages, setCoachMessages] = useState<ChatMessage[]>([]);
  const [coachPrepMessages, setCoachPrepMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [coachStreaming, setCoachStreaming] = useState(false);
  const [coachPrepStreaming, setCoachPrepStreaming] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [chatJobId, setChatJobId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voiceSyncedRef = useRef(0);

  const effectiveJobId = chatView === "chat" && chatJobId !== null
    ? chatJobId
    : drawerCardId !== null
      ? drawerCardId
      : selectedJobId;

  const currentJob =
    chatView === "chat" && fitChatJob
      ? fitChatJob
      : effectiveJobId !== null
        ? kanbanCards.find((c) => c.id === effectiveJobId) ?? null
        : null;
  const needsJobPicker = chatView === "tools" && drawerCardId === null && kanbanCards.length > 0;
  const hasJobs = kanbanCards.length > 0;

  const resetCoachChat = useCallback(() => {
    setCoachMessages([
      {
        role: "assistant",
        content:
          "Paste intake notes or ask how to shape this client's profile. I won't change anything without you approving it in the Career Strategy tab.",
      },
    ]);
    setInput("");
  }, []);

  useEffect(() => {
    if (chatOpen && chatView === "coach") {
      resetCoachChat();
    }
  }, [coachChatNonce, chatOpen, chatView, resetCoachChat]);

  const resetCoachPrepChat = useCallback((coach: NonNullable<typeof coachPrepCoach>) => {
    setCoachPrepMessages([
      {
        role: "assistant",
        content: coachPrepWelcomeMessage(coach.displayName, coach.matchScore, coach.matchLabel),
      },
    ]);
    setInput("");
  }, []);

  useEffect(() => {
    if (!chatOpen || chatView !== "coach-prep" || !coachPrepCoach) return;
    resetCoachPrepChat(coachPrepCoach);
  }, [coachPrepNonce, chatOpen, chatView, coachPrepCoach, resetCoachPrepChat]);

  const resetFitChat = useCallback((job: KanbanCard) => {
    setChatJobId(job.id);
    setMessages([{ role: "assistant", content: fitWelcomeMessage(job) }]);
    setInput("");
  }, []);

  useEffect(() => {
    if (!chatOpen || chatView !== "chat") return;
    const job =
      fitChatJob ??
      (drawerCardId !== null ? kanbanCards.find((c) => c.id === drawerCardId) : null);
    if (job) resetFitChat(job);
  }, [fitChatNonce, chatOpen, chatView, drawerCardId, kanbanCards, fitChatJob, resetFitChat]);

  useEffect(() => {
    if (chatView !== "chat" || !chatOpen) return;
    void fetch("/api/assets")
      .then((r) => r.json())
      .then((rows: Array<{ type?: string }>) => {
        if (!Array.isArray(rows)) {
          setHasResume(false);
          return;
        }
        setHasResume(rows.some((a) => a.type === "RESUME"));
      })
      .catch(() => setHasResume(false));
  }, [chatView, chatOpen, fitChatNonce]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, coachPrepMessages, coachMessages, chatOpen]);

  useEffect(() => {
    if (!unified || !voice) return;
    const lines = voice.transcriptLines ?? [];
    if (lines.length === 0) {
      voiceSyncedRef.current = 0;
      return;
    }
    if (lines.length < voiceSyncedRef.current) {
      voiceSyncedRef.current = 0;
    }
    if (lines.length <= voiceSyncedRef.current) return;

    const newLines = lines.slice(voiceSyncedRef.current);
    voiceSyncedRef.current = lines.length;
    setMessages((prev) => [
      ...prev,
      ...newLines.map((line) => ({
        role: (line.role === "Kimchi" ? "assistant" : "user") as ChatMessage["role"],
        content: line.content,
      })),
    ]);
  }, [unified, voice?.transcriptLines, voice]);

  useEffect(() => {
    if (chatOpen && (chatView === "chat" || chatView === "coach-prep")) {
      window.setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [chatOpen, chatView]);

  const fitSuggestions =
    hasResume === false ? FIT_STARTERS_NO_RESUME : FIT_SUGGESTIONS;

  const showFitStarters = currentJob && messages.length <= 1 && !streaming;
  const showFitFollowups =
    currentJob && messages.length > 1 && !streaming && messages[messages.length - 1]?.role === "assistant";

  const toggleOpen = () => {
    setChatOpen(!chatOpen);
    if (!chatOpen) {
      setChatView("tools");
      setSelectedJobId(null);
    }
  };

  const handleOpenTool = (jobId: number, tool: DrawerTool) => {
    const job = kanbanCards.find((c) => c.id === jobId);
    const ext = job as (typeof kanbanCards[number] & { _dbId?: string }) | undefined;
    if (tool === "fit") {
      if (job) openFitChat(job);
      if (ext?._dbId) router.push(pipelineJobUrl(ext._dbId, "fit"));
      return;
    }
    setDrawerCardId(jobId);
    setDrawerTool(tool);
    setChatOpen(false);
    setSelectedJobId(null);
    if (ext?._dbId) router.push(pipelineJobUrl(ext._dbId, tool));
    else router.push("/opportunities/pipeline");
  };

  const handleFitAction = (action: "resume" | "cover" | "profile" | "create-resume") => {
    if (!currentJob) return;
    if (action === "profile" || action === "create-resume") {
      setChatOpen(false);
      router.push("/profile");
      return;
    }
    handleOpenTool(currentJob.id, action);
  };

  const handleToolClick = (tool: DrawerTool) => {
    if (effectiveJobId !== null) {
      handleOpenTool(effectiveJobId, tool);
    }
  };

  const sendCoachMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || coachStreaming) return;

    const nextMessages: ChatMessage[] = [...coachMessages, { role: "user", content: trimmed }];
    setCoachMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setCoachStreaming(true);

    try {
      const res = await fetch("/api/ai/profile-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        if (res.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
          setCoachMessages((prev) => prev.slice(0, -1));
          return;
        }
        setCoachMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: "That didn't work. Try again." };
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
        const snapshot = accumulated;
        setCoachMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: snapshot };
          return copy;
        });
      }
      notifyCreditsChanged();
    } catch {
      setCoachMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Couldn't reach Scout — check your connection." };
        return copy;
      });
    } finally {
      setCoachStreaming(false);
    }
  };

  const sendCoachPrepMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || coachPrepStreaming || !coachPrepCoach) return;

    const nextMessages: ChatMessage[] = [...coachPrepMessages, { role: "user", content: trimmed }];
    setCoachPrepMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setCoachPrepStreaming(true);

    try {
      const res = await fetch("/api/ai/coach-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, coach: coachPrepCoach }),
      });

      if (!res.ok) {
        if (res.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
          setCoachPrepMessages((prev) => prev.slice(0, -1));
          return;
        }
        const err =
          res.status === 503
            ? "Scout isn't available right now."
            : await (async () => {
                try {
                  const data = await res.clone().json();
                  return typeof data?.error === "string" ? data.error : "That didn't work. Try again.";
                } catch {
                  return "That didn't work. Try again.";
                }
              })();
        setCoachPrepMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: err };
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
        const snapshot = accumulated;
        setCoachPrepMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: snapshot };
          return copy;
        });
      }
      notifyCreditsChanged();
    } catch {
      setCoachPrepMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Couldn't reach Scout — check your connection and try again." };
        return copy;
      });
    } finally {
      setCoachPrepStreaming(false);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    if (!unified && !currentJob) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const pipeline = kanbanCards.map((c) => ({
        company: c.company,
        role: c.role,
        stage: STAGE_LABELS[c.stage],
      }));

      const meta = currentJob ? (currentJob as KanbanCard & { _meta?: JobMeta })._meta : undefined;
      const jobDescription = currentJob
        ? resolveJobDescriptionText(meta, currentJob.role, currentJob.company)
        : "";

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          pipeline,
          focusedJob: currentJob
            ? {
                company: currentJob.company,
                role: currentJob.role,
                intent: "fit",
                description: jobDescription || undefined,
              }
            : null,
        }),
      });

      if (!res.ok) {
        if (res.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
          setMessages((prev) => prev.slice(0, -1));
          return;
        }
        const err =
          res.status === 503
            ? "Scout isn't available right now."
            : await (async () => {
                try {
                  const data = await res.clone().json();
                  return typeof data?.error === "string" ? data.error : "That didn't work. Try again.";
                } catch {
                  return "That didn't work. Try again.";
                }
              })();
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: err };
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
        const snapshot = accumulated;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: snapshot };
          return copy;
        });
      }
      notifyCreditsChanged();
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Couldn't reach Scout — check your connection and try again." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const sendGeneralMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: "Ask about your search, your pipeline, or pick a job for role-specific help.",
        },
      ]);
    }
    await sendMessage(trimmed);
  };

  const unifiedColumnHeaderStyle: CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    background: "#FAFAF8",
    flexShrink: 0,
    fontFamily: sans,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--scout-muted)",
  };

  const renderToolsPanelContent = () => (
    <>
      <CreditsStatusBar onUpgrade={openPricing} />
      <p
        style={{
          fontFamily: sans,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--scout-muted)",
          textTransform: "uppercase",
          letterSpacing: "1px",
          marginBottom: 6,
          marginTop: 4,
        }}
      >
        For this job
      </p>
      {currentJob ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            background: "rgba(26,58,47,0.04)",
            borderRadius: "var(--scout-radius)",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "var(--scout-radius)",
              background: "#1A3A2F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#E8D5A3" }}>
              {currentJob.initials}
            </span>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontFamily: sans,
                fontSize: 14,
                fontWeight: 600,
                color: "#1A1A1A",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                margin: 0,
              }}
            >
              {currentJob.role}
            </p>
            <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0 }}>
              {currentJob.company}
            </p>
          </div>
        </div>
      ) : needsJobPicker ? (
        <select
          value={selectedJobId ?? ""}
          onChange={(e) => setSelectedJobId(e.target.value ? Number(e.target.value) : null)}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: "var(--scout-radius)",
            background: "#FFFFFF",
            fontFamily: sans,
            fontSize: 14,
            color: "#1A1A1A",
            marginBottom: 12,
            cursor: "pointer",
          }}
        >
          <option value="">Pick a job…</option>
          {kanbanCards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.role} · {c.company}
            </option>
          ))}
        </select>
      ) : (
        <p
          style={{
            fontFamily: sans,
            fontSize: 14,
            fontWeight: 400,
            color: "var(--scout-muted)",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          Add a job to your pipeline first.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <ToolButton
          icon="✦"
          title="Tailor resume"
          subtitle="Align your resume to this role"
          disabled={!currentJob}
          onClick={() => handleToolClick("resume")}
        />
        <ToolButton
          icon="✉"
          title="Write cover letter"
          subtitle="Draft something specific to this job"
          disabled={!currentJob}
          onClick={() => handleToolClick("cover")}
        />
        <ToolButton
          icon="👍"
          title="Check my fit"
          subtitle="Honest take on strengths and gaps"
          disabled={!currentJob}
          onClick={() => handleToolClick("fit")}
        />
        <ToolButton
          icon="📋"
          title="Profile coach"
          subtitle="Parse intake and shape profile fields"
          disabled={false}
          onClick={() => openProfileCoach()}
        />
      </div>

      {hasJobs && (
        <p
          style={{
            fontFamily: sans,
            fontSize: 13,
            fontWeight: 400,
            color: "var(--scout-muted)",
            marginTop: 12,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Resume and cover letter open in the job drawer.
        </p>
      )}
    </>
  );

  const renderFitRightPanelContent = () => (
    <>
      {currentJob && (
        <div
          style={{
            padding: "8px 10px",
            background: "rgba(26,58,47,0.04)",
            borderRadius: "var(--scout-radius)",
            marginBottom: 12,
          }}
        >
          <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
            {currentJob.role}
          </p>
          <p
            style={{
              fontFamily: sans,
              fontSize: 13,
              color: "var(--scout-muted)",
              margin: "2px 0 0",
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexWrap: "wrap",
            }}
          >
            <span>
              {currentJob.company}
              {currentJob.fit > 0 ? ` · ${currentJob.fit}% match` : ""}
            </span>
            {currentJob.fit > 0 && <ScoreExplainerPopover variant="job-match" />}
          </p>
        </div>
      )}

      {showFitStarters && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {fitSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => sendMessage(s)}
              style={{
                padding: "8px 10px",
                background: "#FFF",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: "var(--scout-radius)",
                fontFamily: sans,
                fontSize: 13,
                color: "#1A3A2F",
                cursor: "pointer",
                textAlign: "left",
                lineHeight: 1.35,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {showFitFollowups && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {FIT_FOLLOWUP_QUESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendMessage(s)}
                style={{
                  padding: "8px 10px",
                  background: "#FFF",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: "var(--scout-radius)",
                  fontFamily: sans,
                  fontSize: 12,
                  color: "#1A3A2F",
                  cursor: "pointer",
                  textAlign: "left",
                  lineHeight: 1.35,
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(hasResume === false
              ? [
                  { id: "create-resume" as const, label: "Create my resume →" },
                  { id: "profile" as const, label: "Build my profile →" },
                ]
              : [
                  { id: "resume" as const, label: "Improve my resume for this role →" },
                  { id: "cover" as const, label: "Write a cover letter →" },
                  { id: "profile" as const, label: "Update my profile →" },
                ]
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleFitAction(id)}
                style={{
                  padding: "8px 12px",
                  background: "rgba(26,58,47,0.08)",
                  border: "1px solid rgba(26,58,47,0.15)",
                  borderRadius: "var(--scout-radius)",
                  fontFamily: sans,
                  fontSize: 12,
                  fontWeight: 600,
                  color: color.forest,
                  cursor: "pointer",
                  textAlign: "left",
                  lineHeight: 1.35,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {!currentJob && (
        <p style={{ fontFamily: sans, fontSize: 13, color: "var(--scout-muted)", lineHeight: 1.5, margin: 0 }}>
          Pick a job under Actions to get role-specific fit help.
        </p>
      )}

      <button
        type="button"
        onClick={() => setChatView("tools")}
        style={{
          marginTop: 14,
          background: "transparent",
          border: "none",
          padding: 0,
          fontFamily: sans,
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(26,58,47,0.65)",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        ← Back to actions
      </button>
    </>
  );

  const renderUnifiedTwoColumnShell = ({
    conversation,
    isStreaming,
    emptyHint,
    rightTitle,
    rightContent,
    composerPlaceholder,
    onSend,
    sendDisabled,
  }: {
    conversation: ChatMessage[];
    isStreaming?: boolean;
    emptyHint: string;
    rightTitle: string;
    rightContent: ReactNode;
    composerPlaceholder: string;
    onSend: () => void;
    sendDisabled?: boolean;
  }) => (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <div
          style={{
            flex: isMobile ? "0 1 auto" : "1 1 50%",
            minWidth: 0,
            minHeight: isMobile ? 140 : 0,
            maxHeight: isMobile ? "42%" : undefined,
            display: "flex",
            flexDirection: "column",
            borderRight: isMobile ? undefined : "1px solid rgba(0,0,0,0.06)",
            borderBottom: isMobile ? "1px solid rgba(0,0,0,0.06)" : undefined,
          }}
        >
          <div style={unifiedColumnHeaderStyle}>Conversation</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 8px", minHeight: 0 }}>
            {conversation.length === 0 ? (
              <p
                style={{
                  fontFamily: sans,
                  fontSize: 13,
                  color: "var(--scout-muted)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {emptyHint}
              </p>
            ) : (
              renderMessageBubbles(conversation, isStreaming)
            )}
          </div>
        </div>

        <div
          style={{
            flex: "1 1 50%",
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ ...unifiedColumnHeaderStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span>{rightTitle}</span>
            {(chatView === "chat" || chatView === "coach" || chatView === "coach-prep") && <CreditCostBadge />}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", minHeight: 0 }}>{rightContent}</div>
        </div>
      </div>
      {renderUnifiedComposer(composerPlaceholder, onSend, sendDisabled)}
    </div>
  );

  const renderUnifiedPanel = () => {
    if (chatView === "coach-prep") {
      return renderUnifiedTwoColumnShell({
        conversation: coachPrepMessages,
        isStreaming: coachPrepStreaming,
        emptyHint: coachPrepCoach
          ? `Prep questions for ${coachPrepCoach.displayName} show up here.`
          : "Open a coach profile to prep.",
        rightTitle: "Suggestions",
        rightContent: coachPrepCoach ? (
          <>
            {coachPrepCoach.headline && (
              <p style={{ fontFamily: sans, fontSize: 13, color: "var(--scout-muted)", margin: "0 0 10px", lineHeight: 1.45 }}>
                {coachPrepCoach.headline}
                {coachPrepCoach.matchScore && coachPrepCoach.matchScore > 0
                  ? ` · ${coachPrepCoach.matchLabel ?? "Match"} ${coachPrepCoach.matchScore}/100`
                  : ""}
              </p>
            )}
            {coachPrepMessages.length <= 1 && !coachPrepStreaming && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {COACH_PREP_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendCoachPrepMessage(s)}
                    style={{
                      padding: "8px 10px",
                      background: "#FFF",
                      border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: "var(--scout-radius)",
                      fontFamily: sans,
                      fontSize: 13,
                      color: "#1A3A2F",
                      cursor: "pointer",
                      textAlign: "left",
                      lineHeight: 1.35,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontFamily: sans, fontSize: 13, color: "var(--scout-muted)", margin: 0 }}>
            Open a coach profile to prep.
          </p>
        ),
        composerPlaceholder: coachPrepCoach ? "Ask about prep, questions, or fit…" : "Open a coach profile to prep…",
        onSend: () => sendCoachPrepMessage(input),
        sendDisabled: coachPrepStreaming || !coachPrepCoach,
      });
    }

    if (chatView === "coach") {
      return renderUnifiedTwoColumnShell({
        conversation: coachMessages,
        isStreaming: coachStreaming,
        emptyHint: "Paste intake notes or ask how to shape this client's profile.",
        rightTitle: "Profile coach",
        rightContent: (
          <p style={{ fontFamily: sans, fontSize: 13, color: "var(--scout-muted)", lineHeight: 1.5, margin: 0 }}>
            Changes stay in chat until you approve them in Career Strategy.
          </p>
        ),
        composerPlaceholder: "Paste intake notes or ask about profile fields…",
        onSend: () => sendCoachMessage(input),
        sendDisabled: coachStreaming,
      });
    }

    if (chatView === "chat") {
      return renderUnifiedTwoColumnShell({
        conversation: messages,
        isStreaming: streaming,
        emptyHint: "Talk or type to Kimchi — fit chat for this role shows here.",
        rightTitle: "Fit chat",
        rightContent: renderFitRightPanelContent(),
        composerPlaceholder: currentJob ? "Ask about fit, gaps, or tactics…" : "Ask Kimchi anything…",
        onSend: () => sendMessage(input),
        sendDisabled: streaming,
      });
    }

    return renderUnifiedTwoColumnShell({
      conversation: messages,
      isStreaming: streaming,
      emptyHint: "Tap the orb to talk, or type below. Your conversation stays here.",
      rightTitle: "Actions",
      rightContent: renderToolsPanelContent(),
      composerPlaceholder: "Ask Kimchi anything…",
      onSend: () => sendGeneralMessage(input),
      sendDisabled: streaming,
    });
  };

  const renderUnifiedComposer = (
    placeholder: string,
    onSend: () => void,
    sendDisabled?: boolean,
  ) => (
    <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
      {voice && <KimchiVoiceComposerFooter voice={voice} />}
      <CreditsInlineHint />
      <KimchiComposerRow
        voice={voice}
        value={input}
        onChange={setInput}
        onSend={onSend}
        placeholder={placeholder}
        disabled={sendDisabled}
        inputRef={inputRef}
      />
    </div>
  );

  const renderMessageBubbles = (thread: ChatMessage[], isStreaming = false) => (
    <>
      {thread.map((msg, i) => (
        <div
          key={`${msg.role}-${i}-${msg.content.slice(0, 24)}`}
          style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              maxWidth: "88%",
              padding: "10px 12px",
              borderRadius: "var(--scout-radius)",
              background: msg.role === "user" ? "#1A3A2F" : "rgba(26,58,47,0.06)",
              color: msg.role === "user" ? "#E8D5A3" : "#1A1A1A",
              fontFamily: sans,
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            <ChatMessageBody
              role={msg.role}
              content={msg.content}
              streaming={isStreaming && i === thread.length - 1}
            />
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </>
  );

  const panelWidth = isMobile ? "calc(100vw - 24px)" : chatView === "chat" || chatView === "coach" || chatView === "coach-prep" ? 380 : 320;
  const panelBottom = isMobile
    ? `max(${76 + bottomStackOffset}px, calc(${68 + bottomStackOffset}px + env(safe-area-inset-bottom)))`
    : 88 + bottomStackOffset;
  const panelHeight = isMobile
    ? "min(70vh, calc(100vh - env(safe-area-inset-bottom) - 96px))"
    : chatView === "chat" || chatView === "coach" || chatView === "coach-prep"
      ? "min(640px, calc(100vh - 120px))"
      : undefined;

  const panelChrome = (
    <>
      {!unified && (
      <div
        style={{
          padding: embedded ? "10px 14px" : "14px 18px 12px",
          background: "#1A3A2F",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#E8D5A3" }}>✦</span>
                <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: "#E8D5A3" }}>
                  {chatView === "chat"
                    ? "Scout"
                    : chatView === "coach"
                      ? "Profile Coach"
                      : chatView === "coach-prep"
                        ? "Session prep"
                        : "AI Tools"}
                </span>
                {(chatView === "chat" || chatView === "coach" || chatView === "coach-prep") && <CreditCostBadge />}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {(chatView === "chat" || chatView === "coach" || chatView === "coach-prep") && (
                  <button
                    onClick={() => setChatView("tools")}
                    style={{
                      background: "rgba(232,213,163,0.12)",
                      border: "none",
                      borderRadius: "var(--scout-radius)",
                      cursor: "pointer",
                      fontFamily: sans,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#E8D5A3",
                      padding: "4px 8px",
                    }}
                  >
                    Tools
                  </button>
                )}
                {chatView === "tools" && hasJobs && (
                  <button
                    onClick={() => {
                      if (currentJob) {
                        resetFitChat(currentJob);
                        setChatView("chat");
                      }
                    }}
                    disabled={!currentJob}
                    style={{
                      background: currentJob ? "rgba(232,213,163,0.12)" : "transparent",
                      border: "none",
                      borderRadius: "var(--scout-radius)",
                      cursor: currentJob ? "pointer" : "default",
                      fontFamily: sans,
                      fontSize: 13,
                      fontWeight: 600,
                      color: currentJob ? "#E8D5A3" : "rgba(232,213,163,0.35)",
                      padding: "4px 8px",
                    }}
                  >
                    Chat
                  </button>
                )}
                {!embedded && (
                <button
                  onClick={() => {
                    setChatOpen(false);
                    setSelectedJobId(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    color: "rgba(232,213,163,0.6)",
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
                )}
              </div>
            </div>
      )}

            {unified && voice ? (
              renderUnifiedPanel()
            ) : chatView === "coach-prep" ? (
              <>
                {coachPrepCoach && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      background: "rgba(26,58,47,0.03)",
                      flexShrink: 0,
                    }}
                  >
                    <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                      Prepare to meet {coachPrepCoach.displayName}
                    </p>
                    {coachPrepCoach.headline && (
                      <p style={{ fontFamily: sans, fontSize: 13, color: "var(--scout-muted)", margin: "2px 0 0" }}>
                        {coachPrepCoach.headline}
                        {coachPrepCoach.matchScore && coachPrepCoach.matchScore > 0
                          ? ` · ${coachPrepCoach.matchLabel ?? "Match"} ${coachPrepCoach.matchScore}/100`
                          : ""}
                      </p>
                    )}
                  </div>
                )}
                <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
                  {coachPrepMessages.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: 10,
                        display: "flex",
                        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "88%",
                          padding: "10px 12px",
                          borderRadius: "var(--scout-radius)",
                          background: m.role === "user" ? "#1A3A2F" : "rgba(26,58,47,0.06)",
                          color: m.role === "user" ? "#FFFDF9" : "#1A1A1A",
                          fontFamily: sans,
                          fontSize: 14,
                          lineHeight: 1.55,
                        }}
                      >
                        <ChatMessageBody
                          role={m.role}
                          content={m.content}
                          streaming={coachPrepStreaming && i === coachPrepMessages.length - 1}
                        />
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                {coachPrepCoach && coachPrepMessages.length <= 1 && !coachPrepStreaming && (
                  <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
                    {COACH_PREP_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendCoachPrepMessage(s)}
                        style={{
                          padding: "6px 10px",
                          background: "#FFF",
                          border: "1px solid rgba(0,0,0,0.1)",
                          borderRadius: "var(--scout-radius)",
                          fontFamily: sans,
                          fontSize: 13,
                          color: "#1A3A2F",
                          cursor: "pointer",
                          textAlign: "left",
                          lineHeight: 1.35,
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {unified && voice ? (
                  !coachPrepCoach ? (
                    <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
                      <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0, textAlign: "center" }}>
                        Open a coach profile to prep.
                      </p>
                    </div>
                  ) : (
                    renderUnifiedComposer(
                      "Ask about prep, questions, or fit…",
                      () => sendCoachPrepMessage(input),
                      coachPrepStreaming,
                    )
                  )
                ) : (
                <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
                  {!coachPrepCoach ? (
                    <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0, textAlign: "center" }}>
                      Open a coach profile to prep.
                    </p>
                  ) : (
                    <>
                      <CreditsInlineHint />
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                        <textarea
                          ref={inputRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              sendCoachPrepMessage(input);
                            }
                          }}
                          placeholder="Ask about prep, questions, or fit…"
                          rows={2}
                          disabled={coachPrepStreaming}
                          style={{
                            flex: 1,
                            resize: "none",
                            border: "1px solid rgba(0,0,0,0.12)",
                            borderRadius: "var(--scout-radius)",
                            padding: "8px 10px",
                            fontFamily: sans,
                            fontSize: 14,
                            outline: "none",
                            lineHeight: 1.45,
                          }}
                        />
                        <button
                          onClick={() => sendCoachPrepMessage(input)}
                          disabled={coachPrepStreaming || !input.trim()}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "var(--scout-radius)",
                            background: input.trim() && !coachPrepStreaming ? "#1A3A2F" : "rgba(0,0,0,0.08)",
                            border: "none",
                            cursor: input.trim() && !coachPrepStreaming ? "pointer" : "default",
                            color: input.trim() && !coachPrepStreaming ? "#E8D5A3" : "var(--scout-muted)",
                            fontSize: 16,
                            flexShrink: 0,
                          }}
                          aria-label="Send"
                        >
                          ↑
                        </button>
                      </div>
                    </>
                  )}
                </div>
                )}
              </>
            ) : chatView === "coach" ? (
              <>
                <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
                  {coachMessages.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: 10,
                        display: "flex",
                        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "88%",
                          padding: "10px 12px",
                          borderRadius: "var(--scout-radius)",
                          background: m.role === "user" ? "#1A3A2F" : "rgba(26,58,47,0.06)",
                          color: m.role === "user" ? "#FFFDF9" : "#1A1A1A",
                          fontFamily: sans,
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        <ChatMessageBody role={m.role} content={m.content} streaming={coachStreaming && i === coachMessages.length - 1} />
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                {unified && voice ? (
                  renderUnifiedComposer(
                    "Paste intake notes or ask about profile fields…",
                    () => sendCoachMessage(input),
                    coachStreaming,
                  )
                ) : (
                <div style={{ padding: "10px 14px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendCoachMessage(input);
                        }
                      }}
                      placeholder="Paste intake notes or ask about profile fields…"
                      rows={2}
                      style={{
                        flex: 1,
                        resize: "none",
                        padding: "8px 10px",
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: "var(--scout-radius)",
                        fontFamily: sans,
                        fontSize: 14,
                      }}
                    />
                    <button
                      onClick={() => sendCoachMessage(input)}
                      disabled={coachStreaming || !input.trim()}
                      style={{
                        alignSelf: "flex-end",
                        padding: "8px 12px",
                        background: "#1A3A2F",
                        color: "#E8D5A3",
                        border: "none",
                        borderRadius: "var(--scout-radius)",
                        cursor: coachStreaming ? "default" : "pointer",
                        fontFamily: sans,
                        fontSize: 13,
                        fontWeight: 600,
                        opacity: coachStreaming || !input.trim() ? 0.5 : 1,
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
                )}
              </>
            ) : chatView === "chat" ? (
              <>
                {currentJob && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      background: "rgba(26,58,47,0.03)",
                      flexShrink: 0,
                    }}
                  >
                    <p style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                      {currentJob.role}
                    </p>
                    <p style={{ fontFamily: sans, fontSize: 13, color: "var(--scout-muted)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                      <span>
                        {currentJob.company}
                        {currentJob.fit > 0 ? ` · ${currentJob.fit}% match` : ""}
                      </span>
                      {currentJob.fit > 0 && <ScoreExplainerPopover variant="job-match" />}
                    </p>
                  </div>
                )}

                <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
                  {renderMessageBubbles(messages, streaming)}
                </div>

                {showFitStarters && (
                  <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
                    {fitSuggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        style={{
                          padding: "6px 10px",
                          background: "#FFF",
                          border: "1px solid rgba(0,0,0,0.1)",
                          borderRadius: "var(--scout-radius)",
                          fontFamily: sans,
                          fontSize: 13,
                          color: "#1A3A2F",
                          cursor: "pointer",
                          textAlign: "left",
                          lineHeight: 1.35,
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {showFitFollowups && (
                  <>
                    <div style={{ padding: "0 14px 8px", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
                      {FIT_FOLLOWUP_QUESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => sendMessage(s)}
                          style={{
                            padding: "6px 10px",
                            background: "#FFF",
                            border: "1px solid rgba(0,0,0,0.1)",
                            borderRadius: "var(--scout-radius)",
                            fontFamily: sans,
                            fontSize: 12,
                            color: "#1A3A2F",
                            cursor: "pointer",
                            textAlign: "left",
                            lineHeight: 1.35,
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
                      {(hasResume === false
                        ? [
                            { id: "create-resume" as const, label: "Create my resume →" },
                            { id: "profile" as const, label: "Build my profile →" },
                          ]
                        : [
                            { id: "resume" as const, label: "Improve my resume for this role →" },
                            { id: "cover" as const, label: "Write a cover letter →" },
                            { id: "profile" as const, label: "Update my profile →" },
                          ]
                      ).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleFitAction(id)}
                          style={{
                            padding: "8px 12px",
                            background: "rgba(26,58,47,0.08)",
                            border: "1px solid rgba(26,58,47,0.15)",
                            borderRadius: "var(--scout-radius)",
                            fontFamily: sans,
                            fontSize: 12,
                            fontWeight: 600,
                            color: color.forest,
                            cursor: "pointer",
                            textAlign: "left",
                            lineHeight: 1.35,
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {unified && voice ? (
                  renderUnifiedComposer(
                    currentJob ? "Ask about fit, gaps, or tactics…" : "Ask Kimchi anything…",
                    () => sendMessage(input),
                    streaming,
                  )
                ) : (
                <div
                  style={{
                    padding: "10px 12px 14px",
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                    flexShrink: 0,
                  }}
                >
                  {!currentJob ? (
                    <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0, textAlign: "center" }}>
                      Open a saved job to start chatting.
                    </p>
                  ) : (
                    <>
                      <CreditsInlineHint />
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage(input);
                          }
                        }}
                        placeholder="Ask about fit, gaps, or tactics…"
                        rows={2}
                        disabled={streaming}
                        style={{
                          flex: 1,
                          resize: "none",
                          border: "1px solid rgba(0,0,0,0.12)",
                          borderRadius: "var(--scout-radius)",
                          padding: "8px 10px",
                          fontFamily: sans,
                          fontSize: 14,
                          outline: "none",
                          lineHeight: 1.45,
                        }}
                      />
                      <button
                        onClick={() => sendMessage(input)}
                        disabled={streaming || !input.trim()}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "var(--scout-radius)",
                          background: input.trim() && !streaming ? "#1A3A2F" : "rgba(0,0,0,0.08)",
                          border: "none",
                          cursor: input.trim() && !streaming ? "pointer" : "default",
                          color: input.trim() && !streaming ? "#E8D5A3" : "var(--scout-muted)",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                        aria-label="Send"
                      >
                        ↑
                      </button>
                    </div>
                    </>
                  )}
                </div>
                )}
              </>
            ) : (
              <div style={{ padding: "14px 16px 16px", overflowY: "auto" }}>
                <CreditsStatusBar onUpgrade={openPricing} />
                <p
                  style={{
                    fontFamily: sans,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--scout-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 6,
                  }}
                >
                  For this job
                </p>
                {currentJob ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      background: "rgba(26,58,47,0.04)",
                      borderRadius: "var(--scout-radius)",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "var(--scout-radius)",
                        background: "#1A3A2F",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#E8D5A3" }}>
                        {currentJob.initials}
                      </span>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontFamily: sans,
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#1A1A1A",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          margin: 0,
                        }}
                      >
                        {currentJob.role}
                      </p>
                      <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0 }}>
                        {currentJob.company}
                      </p>
                    </div>
                  </div>
                ) : needsJobPicker ? (
                  <select
                    value={selectedJobId ?? ""}
                    onChange={(e) => setSelectedJobId(e.target.value ? Number(e.target.value) : null)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: "var(--scout-radius)",
                      background: "#FFFFFF",
                      fontFamily: sans,
                      fontSize: 14,
                      color: "#1A1A1A",
                      marginBottom: 12,
                      cursor: "pointer",
                    }}
                  >
                    <option value="">Pick a job…</option>
                    {kanbanCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.role} · {c.company}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p
                    style={{
                      fontFamily: sans,
                      fontSize: 14,
                      fontWeight: 400,
                      color: "var(--scout-muted)",
                      marginBottom: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    Add a job to your pipeline first.
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <ToolButton
                    icon="✦"
                    title="Tailor resume"
                    subtitle="Align your resume to this role"
                    disabled={!currentJob}
                    onClick={() => handleToolClick("resume")}
                  />
                  <ToolButton
                    icon="✉"
                    title="Write cover letter"
                    subtitle="Draft something specific to this job"
                    disabled={!currentJob}
                    onClick={() => handleToolClick("cover")}
                  />
                  <ToolButton
                    icon="👍"
                    title="Check my fit"
                    subtitle="Honest take on strengths and gaps"
                    disabled={!currentJob}
                    onClick={() => handleToolClick("fit")}
                  />
                  <ToolButton
                    icon="📋"
                    title="Profile coach"
                    subtitle="Parse intake and shape profile fields"
                    disabled={false}
                    onClick={() => openProfileCoach()}
                  />
                </div>

                {hasJobs && (
                  <p
                    style={{
                      fontFamily: sans,
                      fontSize: 14,
                      fontWeight: 400,
                      color: "var(--scout-muted)",
                      marginTop: 12,
                      textAlign: "center",
                      lineHeight: 1.4,
                    }}
                  >
                    Resume and cover letter open in the job drawer.
                  </p>
                )}
              </div>
            )}
    </>
  );

  if (embedded) {
    return (
      <>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "#FFFFFF",
          }}
        >
          {panelChrome}
        </div>
        {showUpgrade && (
          <GrowthUpgradeModal
            trigger="limit_hit"
            onClose={() => setShowUpgrade(false)}
            onOpenPricing={openPricing}
          />
        )}
      </>
    );
  }

  return (
    <>
      {!hideLauncher && (
      <button
        onClick={toggleOpen}
        aria-label={chatOpen ? "Close Scout" : "Open Scout AI"}
        style={{
          position: "fixed",
          bottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 24,
          right: isMobile ? 12 : 24,
          left: isMobile ? 12 : undefined,
          width: 52,
          height: 52,
          borderRadius: "var(--scout-radius)",
          background: chatOpen ? "#1A3A2F" : "#FFFFFF",
          border: chatPulse ? `2px solid ${color.forest}` : "1px solid rgba(26,58,47,0.15)",
          boxShadow: chatPulse
            ? "0 0 0 6px rgba(26,58,47,0.2), 0 4px 16px rgba(0,0,0,0.12)"
            : "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
          cursor: "pointer",
          zIndex: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
          animation: chatPulse ? "chatPulse 1.2s ease-in-out 2" : undefined,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <span style={{ fontSize: 22, color: chatOpen ? "#E8D5A3" : "#1A3A2F", lineHeight: 1 }}>✦</span>
      </button>
      )}

      <style>{`
        @keyframes chatPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>

      {chatOpen && (
        <>
          <div
            onClick={() => {
              setChatOpen(false);
              setSelectedJobId(null);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 95 }}
          />
          <div
            style={{
              position: "fixed",
              bottom: panelBottom,
              right: isMobile ? 12 : 24,
              left: isMobile ? 12 : undefined,
              width: panelWidth,
              height: panelHeight,
              maxHeight: isMobile ? "calc(100vh - 96px - env(safe-area-inset-bottom))" : undefined,
              background: "#FFFFFF",
              borderRadius: "var(--scout-radius)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid rgba(0,0,0,0.06)",
              zIndex: 100,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              animation: "fadeIn 0.2s ease both",
            }}
          >
            {panelChrome}
          </div>
        </>
      )}
      {showUpgrade && (
        <GrowthUpgradeModal
          trigger="limit_hit"
          onClose={() => setShowUpgrade(false)}
          onOpenPricing={openPricing}
        />
      )}
    </>
  );
}

function ToolButton({
  icon,
  title,
  subtitle,
  disabled,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 12px",
        background: disabled ? "rgba(0,0,0,0.03)" : "#FFFFFF",
        color: disabled ? "var(--scout-muted)" : "#1A1A1A",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "var(--scout-radius)",
        fontFamily: sans,
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(26,58,47,0.04)")}
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "#FFFFFF")}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>
        {title}
        <span style={{ display: "block", fontSize: 13, fontWeight: 400, color: "var(--scout-muted)", marginTop: 1 }}>
          {subtitle}
        </span>
      </span>
    </button>
  );
}
