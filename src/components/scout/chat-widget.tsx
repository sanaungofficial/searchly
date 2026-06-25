"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";

const sans = fontSans;

type ChatMessage = { role: "user" | "assistant"; content: string };

const FIT_SUGGESTIONS = [
  "How well do I fit this role?",
  "What are my biggest gaps?",
  "How can I stand out in my application?",
  "What should I highlight in an interview?",
];

const COACH_PREP_SUGGESTIONS = [
  "What should I ask about their background?",
  "How should I open the session?",
  "What goals should I set for this call?",
  "Is this coach a good fit for me?",
];

function fitWelcomeMessage(job: KanbanCard): string {
  const fitNote = job.fit > 0 ? ` Your resume match score is ${job.fit}%.` : "";
  return `Let's analyze your fit for ${job.role} at ${job.company}.${fitNote} I can walk through your strengths, gaps, and tactics to stand out — pick a suggestion below or ask me anything.`;
}

function coachPrepWelcomeMessage(coachName: string, matchScore?: number, matchLabel?: string): string {
  const matchNote =
    matchScore && matchScore > 0 ? ` Profile match: ${matchLabel ?? "Match"} (${matchScore}/100).` : "";
  return `Let's prepare for your session with ${coachName}.${matchNote} I can help with questions to ask, what to share about your goals, and how to use the time well — pick a suggestion or ask anything.`;
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

export function ChatWidget() {
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
  const [chatJobId, setChatJobId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
          "I'm your profile coach. Paste client intake notes, ask how to update their profile, or get help organizing search strategy fields. Profile updates require your approval in the Career Strategy tab.",
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, coachPrepMessages, chatOpen]);

  useEffect(() => {
    if (chatOpen && (chatView === "chat" || chatView === "coach-prep")) {
      window.setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [chatOpen, chatView]);

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
          copy[copy.length - 1] = { role: "assistant", content: "Something went wrong. Try again." };
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
        copy[copy.length - 1] = { role: "assistant", content: "Couldn't reach Scout. Check your connection." };
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
        const err = res.status === 503 ? "AI is not available right now." : "Something went wrong. Try again.";
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
        copy[copy.length - 1] = { role: "assistant", content: "Couldn't reach Scout. Check your connection and try again." };
        return copy;
      });
    } finally {
      setCoachPrepStreaming(false);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming || !currentJob) return;

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

      const meta = (currentJob as KanbanCard & { _meta?: JobMeta })._meta;
      const jobDescription = resolveJobDescriptionText(
        meta,
        currentJob.role,
        currentJob.company,
      );

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          pipeline,
          focusedJob: {
            company: currentJob.company,
            role: currentJob.role,
            intent: "fit",
            description: jobDescription || undefined,
          },
        }),
      });

      if (!res.ok) {
        if (res.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
          setMessages((prev) => prev.slice(0, -1));
          return;
        }
        const err = res.status === 503 ? "AI is not available right now." : "Something went wrong. Try again.";
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
        copy[copy.length - 1] = { role: "assistant", content: "Couldn't reach Scout. Check your connection and try again." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const panelWidth = isMobile ? "calc(100vw - 24px)" : chatView === "chat" || chatView === "coach" || chatView === "coach-prep" ? 380 : 320;
  const panelHeight = isMobile
    ? "min(70vh, calc(100vh - env(safe-area-inset-bottom) - 96px))"
    : chatView === "chat" || chatView === "coach" || chatView === "coach-prep"
      ? "min(640px, calc(100vh - 120px))"
      : undefined;

  return (
    <>
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
          borderRadius: 0,
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
              bottom: isMobile ? "max(76px, calc(68px + env(safe-area-inset-bottom)))" : 88,
              right: isMobile ? 12 : 24,
              left: isMobile ? 12 : undefined,
              width: panelWidth,
              height: panelHeight,
              maxHeight: isMobile ? "calc(100vh - 96px - env(safe-area-inset-bottom))" : undefined,
              background: "#FFFFFF",
              borderRadius: 0,
              boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid rgba(0,0,0,0.06)",
              zIndex: 100,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              animation: "fadeIn 0.2s ease both",
            }}
          >
            <div
              style={{
                padding: "14px 18px 12px",
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
                      borderRadius: 0,
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
                      borderRadius: 0,
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
              </div>
            </div>

            {chatView === "coach-prep" ? (
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
                          borderRadius: 0,
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
                          borderRadius: 0,
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
                <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
                  {!coachPrepCoach ? (
                    <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0, textAlign: "center" }}>
                      Open a coach profile to prep for your session.
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
                          placeholder="Ask how to prepare for this coach…"
                          rows={2}
                          disabled={coachPrepStreaming}
                          style={{
                            flex: 1,
                            resize: "none",
                            border: "1px solid rgba(0,0,0,0.12)",
                            borderRadius: 0,
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
                            borderRadius: 0,
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
                          borderRadius: 0,
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
                      placeholder="Paste intake notes or ask about profile updates…"
                      rows={2}
                      style={{
                        flex: 1,
                        resize: "none",
                        padding: "8px 10px",
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 0,
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
                        borderRadius: 0,
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
                  {messages.map((msg, i) => (
                    <div
                      key={i}
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
                          borderRadius: 0,
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
                          streaming={streaming && i === messages.length - 1}
                        />
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {currentJob && messages.length <= 1 && !streaming && (
                  <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
                    {FIT_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        style={{
                          padding: "6px 10px",
                          background: "#FFF",
                          border: "1px solid rgba(0,0,0,0.1)",
                          borderRadius: 0,
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

                <div
                  style={{
                    padding: "10px 12px 14px",
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                    flexShrink: 0,
                  }}
                >
                  {!currentJob ? (
                    <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: 0, textAlign: "center" }}>
                      Open a job to chat about fit.
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
                        placeholder="Ask about your fit…"
                        rows={2}
                        disabled={streaming}
                        style={{
                          flex: 1,
                          resize: "none",
                          border: "1px solid rgba(0,0,0,0.12)",
                          borderRadius: 0,
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
                          borderRadius: 0,
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
                      borderRadius: 0,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 0,
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
                      borderRadius: 0,
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
                    Add a job first to use AI tools.
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <ToolButton
                    icon="✦"
                    title="Update resume"
                    subtitle="Maximize your interview chances"
                    disabled={!currentJob}
                    onClick={() => handleToolClick("resume")}
                  />
                  <ToolButton
                    icon="✉"
                    title="Create cover letter"
                    subtitle="Make your application stand out"
                    disabled={!currentJob}
                    onClick={() => handleToolClick("cover")}
                  />
                  <ToolButton
                    icon="👍"
                    title="Tell me why I'm a good fit"
                    subtitle="Chat about strengths & gaps"
                    disabled={!currentJob}
                    onClick={() => handleToolClick("fit")}
                  />
                  <ToolButton
                    icon="📋"
                    title="Profile coach"
                    subtitle="Parse intake notes & update profile"
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
                    Fit analysis opens Scout chat. Resume & cover letter open the job drawer.
                  </p>
                )}
              </div>
            )}
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
        borderRadius: 0,
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
