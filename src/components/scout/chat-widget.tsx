"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { STAGE_LABELS, type KanbanCard } from "./workspace-data";
import type { DrawerTool } from "./workspace-opportunities";

const sans = "var(--font-ui)";

type ChatMessage = { role: "user" | "assistant"; content: string };

const FIT_SUGGESTIONS = [
  "How well do I fit this role?",
  "What are my biggest gaps?",
  "How can I stand out in my application?",
  "What should I highlight in an interview?",
];

function fitWelcomeMessage(job: KanbanCard): string {
  const fitNote = job.fit > 0 ? ` Your resume match score is ${job.fit}%.` : "";
  return `Let's analyze your fit for ${job.role} at ${job.company}.${fitNote} I can walk through your strengths, gaps, and tactics to stand out — pick a suggestion below or ask me anything.`;
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
    openFitChat,
  } = useWorkspace();

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatJobId, setChatJobId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const effectiveJobId = chatView === "chat" && chatJobId !== null
    ? chatJobId
    : drawerCardId !== null
      ? drawerCardId
      : selectedJobId;

  const currentJob = effectiveJobId !== null ? kanbanCards.find((c) => c.id === effectiveJobId) : null;
  const needsJobPicker = chatView === "tools" && drawerCardId === null && kanbanCards.length > 0;
  const hasJobs = kanbanCards.length > 0;

  const resetFitChat = useCallback((job: KanbanCard) => {
    setChatJobId(job.id);
    setMessages([{ role: "assistant", content: fitWelcomeMessage(job) }]);
    setInput("");
  }, []);

  useEffect(() => {
    if (chatOpen && chatView === "chat" && drawerCardId !== null) {
      const job = kanbanCards.find((c) => c.id === drawerCardId);
      if (job) {
        resetFitChat(job);
      }
    }
  }, [fitChatNonce, chatOpen, chatView, drawerCardId, kanbanCards, resetFitChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  useEffect(() => {
    if (chatOpen && chatView === "chat") {
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
    if (tool === "fit") {
      openFitChat(jobId);
      return;
    }
    setDrawerCardId(jobId);
    setDrawerTool(tool);
    setChatOpen(false);
    setSelectedJobId(null);
    router.push("/opportunities");
  };

  const handleToolClick = (tool: DrawerTool) => {
    if (effectiveJobId !== null) {
      handleOpenTool(effectiveJobId, tool);
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

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          pipeline,
          focusedJob: { company: currentJob.company, role: currentJob.role, intent: "fit" },
        }),
      });

      if (!res.ok) {
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

  const panelWidth = chatView === "chat" ? 380 : 320;
  const panelHeight = chatView === "chat" ? 480 : undefined;

  return (
    <>
      <button
        onClick={toggleOpen}
        aria-label={chatOpen ? "Close Scout" : "Open Scout AI"}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: chatOpen ? "#1A3A2F" : "#FFFFFF",
          border: chatPulse ? "2px solid #4A8B6A" : "1px solid rgba(26,58,47,0.15)",
          boxShadow: chatPulse
            ? "0 0 0 6px rgba(74,139,106,0.25), 0 4px 16px rgba(0,0,0,0.12)"
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
              bottom: 88,
              right: 24,
              width: panelWidth,
              height: panelHeight,
              background: "#FFFFFF",
              borderRadius: 12,
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
                  {chatView === "chat" ? "Scout" : "AI Tools"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {chatView === "chat" && (
                  <button
                    onClick={() => setChatView("tools")}
                    style={{
                      background: "rgba(232,213,163,0.12)",
                      border: "none",
                      borderRadius: 5,
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
                      borderRadius: 5,
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

            {chatView === "chat" ? (
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
                    <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                      {currentJob.role}
                    </p>
                    <p style={{ fontFamily: sans, fontSize: 13, color: "var(--scout-muted)", margin: "2px 0 0" }}>
                      {currentJob.company}
                      {currentJob.fit > 0 ? ` · ${currentJob.fit}% match` : ""}
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
                          borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                          background: msg.role === "user" ? "#1A3A2F" : "rgba(26,58,47,0.06)",
                          color: msg.role === "user" ? "#E8D5A3" : "#1A1A1A",
                          fontFamily: sans,
                          fontSize: 12,
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {msg.content || (streaming && i === messages.length - 1 ? "…" : "")}
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
                          borderRadius: 16,
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
                    <p style={{ fontFamily: sans, fontSize: 12, color: "var(--scout-muted)", margin: 0, textAlign: "center" }}>
                      Open a job to chat about fit.
                    </p>
                  ) : (
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
                          borderRadius: 8,
                          padding: "8px 10px",
                          fontFamily: sans,
                          fontSize: 12,
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
                          borderRadius: 8,
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
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: "14px 16px 16px", overflowY: "auto" }}>
                <p
                  style={{
                    fontFamily: sans,
                    fontSize: 12,
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
                      borderRadius: 6,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 5,
                        background: "#1A3A2F",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: "#E8D5A3" }}>
                        {currentJob.initials}
                      </span>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontFamily: sans,
                          fontSize: 12,
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
                      <p style={{ fontFamily: sans, fontSize: 12, color: "var(--scout-muted)", margin: 0 }}>
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
                      borderRadius: 6,
                      background: "#FFFFFF",
                      fontFamily: sans,
                      fontSize: 12,
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
                      fontSize: 12,
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
                </div>

                {hasJobs && (
                  <p
                    style={{
                      fontFamily: sans,
                      fontSize: 12,
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
        borderRadius: 7,
        fontFamily: sans,
        fontSize: 12,
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
