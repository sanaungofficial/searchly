"use client";

import { useState, useRef, useEffect } from "react";
import type { KanbanCard, KanbanStage } from "./workspace-data";

const STAGE_LABELS: Record<KanbanStage, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interviewing",
  offer: "Offer",
  closed: "Closed",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWidgetProps {
  kanbanCards: KanbanCard[];
  currentJobId: number | null;
  onOpenTool: (jobId: number, tool: "resume" | "cover" | "fit") => void;
}

const SUGGESTED_PROMPTS = [
  "How's my pipeline looking?",
  "What should I focus on this week?",
  "How do I follow up after an interview?",
  "Help me prep for a screening call",
];

export function ChatWidget({ kanbanCards, currentJobId }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentJob = currentJobId !== null ? kanbanCards.find((c) => c.id === currentJobId) : null;

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const pipeline = kanbanCards.map((c) => ({
    company: c.company,
    role: c.role,
    stage: STAGE_LABELS[c.stage],
  }));

  const focusedJob = currentJob
    ? { company: currentJob.company, role: currentJob.role }
    : null;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, pipeline, focusedJob }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Try again." },
        ]);
        return;
      }

      // Stream the response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: assistantText },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error. Try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="AI Coach"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: open ? "#1A3A2F" : "#FFFFFF",
          border: "1px solid rgba(26,58,47,0.15)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
          cursor: "pointer",
          zIndex: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? (
          <span style={{ fontSize: 18, color: "#E8D5A3", lineHeight: 1 }}>✕</span>
        ) : (
          <span style={{ fontSize: 22, color: "#1A3A2F", lineHeight: 1 }}>✦</span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            width: 360,
            height: 520,
            background: "#FFFFFF",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "fadeIn 0.2s ease both",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              background: "#1A3A2F",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: "#E8D5A3" }}>✦</span>
              <div>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#E8D5A3", lineHeight: 1 }}>
                  Scout
                </p>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "rgba(232,213,163,0.6)", marginTop: 2 }}>
                  Your AI job search coach
                </p>
              </div>
            </div>
            {currentJob && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "rgba(255,255,255,0.08)", borderRadius: 5 }}>
                <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, color: "rgba(232,213,163,0.7)" }}>
                  {currentJob.company}
                </span>
              </div>
            )}
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 16px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#7A7268", lineHeight: 1.5, textAlign: "center", padding: "8px 0 4px" }}>
                  Ask me anything about your job search.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      style={{
                        padding: "8px 12px",
                        background: "#F8F6F2",
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 8,
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 12,
                        color: "#1A3A2F",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(26,58,47,0.06)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#F8F6F2")}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "9px 12px",
                    borderRadius: msg.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                    background: msg.role === "user" ? "#1A3A2F" : "#F2EDE3",
                    color: msg.role === "user" ? "#E8D5A3" : "#1A1A1A",
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.content || (loading && i === messages.length - 1 ? (
                    <span style={{ opacity: 0.5 }}>●●●</span>
                  ) : "")}
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "9px 14px", borderRadius: "10px 10px 10px 2px", background: "#F2EDE3" }}>
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#A09890", letterSpacing: 2 }}>●●●</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid rgba(0,0,0,0.07)",
              background: "#FAFAF8",
              flexShrink: 0,
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your search…"
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 8,
                padding: "8px 10px",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                color: "#1A1A1A",
                background: "#FFFFFF",
                outline: "none",
                lineHeight: 1.5,
                maxHeight: 80,
                overflowY: "auto",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 80) + "px";
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: input.trim() && !loading ? "#1A3A2F" : "rgba(0,0,0,0.08)",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke={input.trim() && !loading ? "#E8D5A3" : "#A09890"} strokeWidth="2" strokeLinecap="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() && !loading ? "#E8D5A3" : "#A09890"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
