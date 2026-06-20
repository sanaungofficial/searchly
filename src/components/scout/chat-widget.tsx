"use client";

import { useState } from "react";
import type { KanbanCard } from "./workspace-data";
import type { DrawerTool } from "./workspace-opportunities";

interface ChatWidgetProps {
  /** All jobs in the pipeline (for the job picker when no drawer is open) */
  kanbanCards: KanbanCard[];
  /** The job currently open in the drawer, if any */
  currentJobId: number | null;
  /** Called when a tool button is clicked. Opens the drawer with the selected job + tool. */
  onOpenTool: (jobId: number, tool: DrawerTool) => void;
}

export function ChatWidget({ kanbanCards, currentJobId, onOpenTool }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  const effectiveJobId = currentJobId !== null ? currentJobId : selectedJobId;
  const currentJob = effectiveJobId !== null ? kanbanCards.find((c) => c.id === effectiveJobId) : null;
  const needsJobPicker = currentJobId === null && kanbanCards.length > 0;
  const hasJobs = kanbanCards.length > 0;

  const handleToolClick = (tool: DrawerTool) => {
    if (effectiveJobId !== null) {
      onOpenTool(effectiveJobId, tool);
      setOpen(false);
      setSelectedJobId(null);
    }
  };

  return (
    <>
      {/* Floating sparkle button — bottom-right of every workspace page */}
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="AI Tools"
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
        <span style={{ fontSize: 22, color: open ? "#E8D5A3" : "#1A3A2F", lineHeight: 1 }}>✦</span>
      </button>

      {/* Popup panel */}
      {open && (
        <>
          {/* Click-away catcher */}
          <div
            onClick={() => {
              setOpen(false);
              setSelectedJobId(null);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 95 }}
          />
          <div
            style={{
              position: "fixed",
              bottom: 88,
              right: 24,
              width: 320,
              background: "#FFFFFF",
              borderRadius: 12,
              boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid rgba(0,0,0,0.06)",
              zIndex: 100,
              overflow: "hidden",
              animation: "fadeIn 0.2s ease both",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "14px 18px 12px",
                background: "#1A3A2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#E8D5A3" }}>✦</span>
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#E8D5A3",
                  }}
                >
                  AI Tools
                </span>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
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

            {/* Body */}
            <div style={{ padding: "14px 16px 16px" }}>
              {/* Job context */}
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#A09890",
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
                    <span
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 9,
                        fontWeight: 600,
                        color: "#E8D5A3",
                      }}
                    >
                      {currentJob.initials}
                    </span>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {currentJob.role}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 9,
                        color: "#7A7268",
                      }}
                    >
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
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
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
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: 300,
                    color: "#A09890",
                    marginBottom: 12,
                    lineHeight: 1.5,
                  }}
                >
                  Add a job first to use AI tools.
                </p>
              )}

              {/* 3 tool buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  onClick={() => handleToolClick("resume")}
                  disabled={!currentJob}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 12px",
                    background: currentJob ? "#FFFFFF" : "rgba(0,0,0,0.03)",
                    color: currentJob ? "#1A1A1A" : "#A09890",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 7,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: currentJob ? "pointer" : "not-allowed",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => currentJob && (e.currentTarget.style.background = "rgba(26,58,47,0.04)")}
                  onMouseLeave={(e) => currentJob && (e.currentTarget.style.background = "#FFFFFF")}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>✦</span>
                  <span style={{ flex: 1 }}>
                    Update resume
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 300,
                        color: "#7A7268",
                        marginTop: 1,
                      }}
                    >
                      Maximize your interview chances
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => handleToolClick("cover")}
                  disabled={!currentJob}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 12px",
                    background: currentJob ? "#FFFFFF" : "rgba(0,0,0,0.03)",
                    color: currentJob ? "#1A1A1A" : "#A09890",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 7,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: currentJob ? "pointer" : "not-allowed",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => currentJob && (e.currentTarget.style.background = "rgba(26,58,47,0.04)")}
                  onMouseLeave={(e) => currentJob && (e.currentTarget.style.background = "#FFFFFF")}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>✉</span>
                  <span style={{ flex: 1 }}>
                    Create cover letter
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 300,
                        color: "#7A7268",
                        marginTop: 1,
                      }}
                    >
                      Make your application stand out
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => handleToolClick("fit")}
                  disabled={!currentJob}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 12px",
                    background: currentJob ? "#FFFFFF" : "rgba(0,0,0,0.03)",
                    color: currentJob ? "#1A1A1A" : "#A09890",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 7,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: currentJob ? "pointer" : "not-allowed",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => currentJob && (e.currentTarget.style.background = "rgba(26,58,47,0.04)")}
                  onMouseLeave={(e) => currentJob && (e.currentTarget.style.background = "#FFFFFF")}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>👍</span>
                  <span style={{ flex: 1 }}>
                    Tell me why I&apos;m a good fit
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 300,
                        color: "#7A7268",
                        marginTop: 1,
                      }}
                    >
                      Understand your strengths &amp; gaps
                    </span>
                  </span>
                </button>
              </div>

              {/* Footer hint */}
              {hasJobs && (
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 9,
                    fontWeight: 300,
                    color: "#A09890",
                    marginTop: 12,
                    textAlign: "center",
                    lineHeight: 1.4,
                  }}
                >
                  Opens the job drawer with the tool ready to go.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
