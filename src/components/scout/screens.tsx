"use client";

import React, { useRef, useState } from "react";
import {
  UploadIcon,
  CheckCircleFilled,
  CheckCircleSmall,
  CheckCircleTiny,
  LinkedInIcon,
  ArrowRightIcon,
  ArrowRightSmall,
  ClockIcon,
} from "./icons";

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */
export type Screen = 0 | 1 | 2 | 3 | 4;

export interface Job {
  id: number;
  company: string;
  role: string;
  initials: string;
  state: "reading" | "ready";
}

/* ──────────────────────────────────────────────────────────────
   Header — Searchly logo + progress segments
   ────────────────────────────────────────────────────────────── */
const FULL = "#1A3A2F";
const EMPTY = "rgba(26,58,47,0.15)";

export function ScoutHeader({ screen, onScoutClick }: { screen: Screen; onScoutClick?: () => void }) {
  return (
    <div
      className="w-full max-w-[720px] flex justify-between items-start"
      style={{ paddingTop: 40, paddingBottom: 0 }}
    >
      <div>
        <button
          onClick={onScoutClick}
          disabled={!onScoutClick}
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: 19,
            fontWeight: 500,
            color: "#1A1A1A",
            letterSpacing: "-0.3px",
            lineHeight: 1,
            background: "none",
            border: "none",
            padding: 0,
            cursor: onScoutClick ? "pointer" : "default",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => onScoutClick && (e.currentTarget.style.opacity = "0.6")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          title={onScoutClick ? "Go to workspace" : undefined}
        >
          Searchly
        </button>
        <div
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 400,
            color: "#A09890",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          by Second Ladder
        </div>
      </div>
      <div className="flex gap-[5px] items-center" style={{ paddingTop: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 30,
              height: 2,
              borderRadius: 1,
              background: screen >= i ? FULL : EMPTY,
              transition: "background 0.6s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 0 — Welcome + resume upload
   ────────────────────────────────────────────────────────────── */
interface WelcomeProps {
  resumeFilename: string | null;
  resumeUploaded: boolean;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ScreenWelcome({
  resumeFilename,
  resumeUploaded,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileClick,
  onFileChange,
}: WelcomeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropBorder = isDragging ? "#1A3A2F" : "rgba(26,58,47,0.22)";
  const dropBg = isDragging ? "rgba(26,58,47,0.04)" : "transparent";

  return (
    <div className="flex flex-col gap-[30px]">
      <h1
        className="anim-fade-up"
        style={{
          fontFamily: "var(--font-cormorant), Georgia, serif",
          fontSize: 56,
          fontWeight: 500,
          fontStyle: "italic",
          color: "#1A1A1A",
          lineHeight: 1.03,
          letterSpacing: "-0.3px",
          animationDelay: "0.1s",
        }}
      >
        Hello. I&apos;m Searchly.
      </h1>
      <p
        className="anim-fade-up"
        style={{
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 18,
          fontWeight: 300,
          color: "#52493F",
          lineHeight: 1.7,
          maxWidth: 460,
          animationDelay: "0.5s",
          textWrap: "pretty",
        }}
      >
        I&apos;ll read your resume and get you set up to apply faster. Drop it below to get
        started.
      </p>

      {/* Upload zone */}
      <div className="anim-fade-up" style={{ animationDelay: "1.0s" }}>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={onFileClick}
          style={{
            border: `1.5px dashed ${dropBorder}`,
            borderRadius: 10,
            padding: "54px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            cursor: "pointer",
            background: dropBg,
            transition: "border-color 0.2s, background 0.2s",
            userSelect: "none",
          }}
        >
          <UploadIcon />
          <div className="text-center flex flex-col gap-[5px]">
            <span
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 15,
                fontWeight: 400,
                color: "#2E2820",
              }}
            >
              Drop your resume here
            </span>
            <span
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 300,
                color: "#A09890",
              }}
            >
              PDF or DOCX · click to browse
            </span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </div>

      {/* Uploaded state */}
      {resumeUploaded && (
        <div
          className="anim-fade-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 20px",
            background: "rgba(26,58,47,0.06)",
            borderRadius: 8,
          }}
        >
          <CheckCircleFilled />
          <span
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 14,
              fontWeight: 500,
              color: "#1A3A2F",
              flex: 1,
            }}
          >
            {resumeFilename}
          </span>
          <span
            className="anim-pulse"
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 300,
              color: "#A09890",
            }}
          >
            Reading…
          </span>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 1 — LinkedIn input
   ────────────────────────────────────────────────────────────── */
interface LinkedInProps {
  resumeFilename: string | null;
  liInput: string;
  liSubmitting: boolean;
  onLIChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLIKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onLISubmit: () => void;
}

export function ScreenLinkedIn({
  resumeFilename,
  liInput,
  liSubmitting,
  onLIChange,
  onLIKey,
  onLISubmit,
}: LinkedInProps) {
  return (
    <div className="flex flex-col gap-8">
      <div
        className="anim-fade-in"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 14px 7px 10px",
          background: "rgba(26,58,47,0.08)",
          borderRadius: 100,
          width: "fit-content",
        }}
      >
        <CheckCircleTiny />
        <span
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 12,
            fontWeight: 500,
            color: "#1A3A2F",
          }}
        >
          {resumeFilename}
        </span>
      </div>

      <h2
        className="anim-fade-up"
        style={{
          fontFamily: "var(--font-cormorant), Georgia, serif",
          fontSize: 50,
          fontWeight: 500,
          fontStyle: "italic",
          color: "#1A1A1A",
          lineHeight: 1.05,
          letterSpacing: "-0.2px",
          animationDelay: "0.2s",
        }}
      >
        What&apos;s your LinkedIn?
      </h2>
      <p
        className="anim-fade-up"
        style={{
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 17,
          fontWeight: 300,
          color: "#52493F",
          lineHeight: 1.65,
          maxWidth: 420,
          animationDelay: "0.55s",
          textWrap: "pretty",
        }}
      >
        I&apos;ll use it to round out the picture — especially experience that may not be on the
        resume.
      </p>

      {/* Input */}
      {!liSubmitting && (
        <div className="anim-fade-up" style={{ animationDelay: "0.9s" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderBottom: "1.5px solid #1A3A2F",
              paddingBottom: 14,
            }}
          >
            <LinkedInIcon style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="linkedin.com/in/your-name"
              value={liInput}
              onChange={onLIChange}
              onKeyDown={onLIKey}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 16,
                fontWeight: 400,
                color: "#1A1A1A",
                caretColor: "#1A3A2F",
              }}
            />
            <button
              onClick={onLISubmit}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                opacity: liInput.trim() ? 1 : 0.28,
                transition: "opacity 0.2s",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ArrowRightIcon />
            </button>
          </div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 300,
              color: "#A09890",
              marginTop: 10,
            }}
          >
            Press Enter to continue
          </p>
        </div>
      )}

      {/* Analyzing state */}
      {liSubmitting && (
        <div className="anim-fade-in" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            className="anim-spin"
            style={{
              width: 16,
              height: 16,
              border: "1.5px solid rgba(26,58,47,0.2)",
              borderTopColor: "#1A3A2F",
              borderRadius: "50%",
              flexShrink: 0,
            }}
          />
          <p
            className="anim-pulse"
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 16,
              fontWeight: 300,
              color: "#52493F",
            }}
          >
            Analyzing your background…
          </p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 2 — The Read-Back
   ────────────────────────────────────────────────────────────── */
interface ReadBackProps {
  onConfirm: () => void;
  onRefine: () => void;
}

interface ReadBackData {
  picture: string;
  strengths: string[];
  targetRoles: { role: string; fit: string }[];
  honestNote: string;
}

function fitColor(fit: string): string {
  if (fit === "Strong match") return "#4A8B6A";
  if (fit === "Good fit") return "#A89462";
  return "#8A7A6A";
}

export function ScreenReadBack({ onConfirm, onRefine }: ReadBackProps) {
  const [data, setData] = React.useState<ReadBackData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/ai/readback")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(true); }
        else { setData(d); }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-9">
      <div className="anim-fade-up" style={{ animationDelay: "0.1s" }}>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 10,
            fontWeight: 500,
            color: "#A09890",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Searchly&apos;s read
        </p>
        <h2
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: 50,
            fontWeight: 500,
            fontStyle: "italic",
            color: "#1A1A1A",
            lineHeight: 1.04,
            letterSpacing: "-0.2px",
          }}
        >
          Here&apos;s what I see.
        </h2>
      </div>

      {/* Profile card */}
      <div className="anim-fade-up" style={{ animationDelay: "0.45s" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 10,
            padding: 40,
            boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 10px 28px rgba(0,0,0,0.07)",
            minHeight: loading ? 320 : undefined,
          }}
        >
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 500, color: "#A09890", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
                Reading your resume...
              </p>
              {[180, 220, 140].map((w, i) => (
                <div key={i} style={{ height: 14, width: w, borderRadius: 6, background: "#F0EDE8", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
              <div style={{ height: 1, background: "#EEE9E2", margin: "10px 0" }} />
              {[160, 200, 140].map((w, i) => (
                <div key={i} style={{ height: 14, width: w, borderRadius: 6, background: "#F0EDE8", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.2 + 0.3}s` }} />
              ))}
            </div>
          )}

          {!loading && (error || !data) && (
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#6B6258", lineHeight: 1.6 }}>
              We couldn&apos;t generate a profile read — your resume may not have uploaded correctly. You can continue and update your profile in the workspace.
            </p>
          )}

          {!loading && data && (
            <>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 10,
                  fontWeight: 500,
                  color: "#A09890",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: 20,
                }}
              >
                A picture of you
              </p>

              <p
                style={{
                  fontFamily: "var(--font-cormorant), Georgia, serif",
                  fontSize: 19,
                  fontWeight: 400,
                  color: "#2A2218",
                  lineHeight: 1.78,
                  marginBottom: 28,
                  textWrap: "pretty",
                }}
              >
                {data.picture}
              </p>

              {/* Strengths */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 7,
                  marginBottom: 28,
                  paddingBottom: 28,
                  borderBottom: "1px solid #EEE9E2",
                }}
              >
                {data.strengths.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "6px 14px",
                      background: "#F5F3EF",
                      borderRadius: 100,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 12,
                      color: "#2A2218",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* Target roles */}
              <div
                style={{
                  borderLeft: "2px solid #1A3A2F",
                  paddingLeft: 20,
                  marginBottom: 28,
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#A09890",
                    letterSpacing: "0.9px",
                    textTransform: "uppercase",
                    marginBottom: 14,
                  }}
                >
                  You&apos;d thrive as
                </p>
                <div className="flex flex-col gap-[11px]">
                  {data.targetRoles.map((r) => (
                    <div
                      key={r.role}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-cormorant), Georgia, serif",
                          fontSize: 18,
                          fontWeight: 500,
                          color: "#1A1A1A",
                        }}
                      >
                        {r.role}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 11,
                          fontWeight: 400,
                          color: fitColor(r.fit),
                        }}
                      >
                        {r.fit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* One honest note */}
              <div style={{ padding: "18px 22px", background: "#FBF8F2", borderRadius: 7 }}>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#A09890",
                    letterSpacing: "0.9px",
                    textTransform: "uppercase",
                    marginBottom: 9,
                  }}
                >
                  One honest note
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 13,
                    fontWeight: 300,
                    color: "#6B6258",
                    lineHeight: 1.6,
                    textWrap: "pretty",
                  }}
                >
                  {data.honestNote}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Follow-up + CTA */}
      <div className="anim-fade-up" style={{ animationDelay: "0.85s" }}>
        <p
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: 21,
            fontStyle: "italic",
            fontWeight: 400,
            color: "#52493F",
            lineHeight: 1.55,
            marginBottom: 24,
          }}
        >
          Does this feel like you?
        </p>
        <div className="flex gap-[10px] items-center">
          <button
            onClick={onConfirm}
            style={{
              padding: "14px 30px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 5,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              letterSpacing: "0.2px",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Yes, carry on →
          </button>
          <button
            onClick={onRefine}
            style={{
              padding: "14px 24px",
              background: "transparent",
              color: "#52493F",
              border: "1px solid rgba(26,58,47,0.2)",
              borderRadius: 5,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 14,
              fontWeight: 400,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(26,58,47,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Refine this
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 3 — Target Jobs
   ────────────────────────────────────────────────────────────── */
interface TargetJobsProps {
  jobInput: string;
  jobs: Job[];
  onJobChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onJobKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onAddJob: () => void;
  onFinish: () => void;
}

export function ScreenTargetJobs({
  jobInput,
  jobs,
  onJobChange,
  onJobKey,
  onAddJob,
  onFinish,
}: TargetJobsProps) {
  const canAdd = jobs.length < 3;
  const allReady = jobs.length > 0 && jobs.every((j) => j.state === "ready");

  return (
    <div className="flex flex-col gap-8">
      <h2
        className="anim-fade-up"
        style={{
          fontFamily: "var(--font-cormorant), Georgia, serif",
          fontSize: 50,
          fontWeight: 500,
          fontStyle: "italic",
          color: "#1A1A1A",
          lineHeight: 1.05,
          letterSpacing: "-0.2px",
          animationDelay: "0.1s",
        }}
      >
        Show me what you&apos;re aiming for.
      </h2>
      <p
        className="anim-fade-up"
        style={{
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 17,
          fontWeight: 300,
          color: "#52493F",
          lineHeight: 1.65,
          maxWidth: 440,
          animationDelay: "0.4s",
          textWrap: "pretty",
        }}
      >
        Paste 1–3 job URLs you&apos;re excited about. I&apos;ll read each one and prepare your
        application.
      </p>

      {/* Job URL input */}
      {canAdd && (
        <div className="anim-fade-up" style={{ animationDelay: "0.7s" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderBottom: "1.5px solid rgba(26,58,47,0.22)",
              paddingBottom: 14,
            }}
          >
            <ClockIcon style={{ flexShrink: 0 }} />
            <input
              type="url"
              placeholder="Paste a job URL here…"
              value={jobInput}
              onChange={onJobChange}
              onKeyDown={onJobKey}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 15,
                fontWeight: 400,
                color: "#1A1A1A",
                caretColor: "#1A3A2F",
              }}
            />
            <button
              onClick={onAddJob}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                opacity: jobInput.trim() ? 1 : 0.28,
                transition: "opacity 0.2s",
                padding: 4,
                display: "flex",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.opacity = jobInput.trim() ? "1" : "0.28")
              }
            >
              <ArrowRightSmall />
            </button>
          </div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 300,
              color: "#A09890",
              marginTop: 10,
            }}
          >
            Press Enter or → to add
          </p>
        </div>
      )}

      {/* Job cards */}
      <div className="flex flex-col gap-[10px]">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="anim-slide-up"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              background: "#FFFFFF",
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 3px 10px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  background: "#F0EDE6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#3A3020",
                  }}
                >
                  {job.initials}
                </span>
              </div>
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#1A1A1A",
                    marginBottom: 3,
                  }}
                >
                  {job.role}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    fontWeight: 400,
                    color: "#A09890",
                  }}
                >
                  {job.company}
                </p>
              </div>
            </div>
            <div>
              {job.state === "reading" && (
                <span
                  className="anim-pulse"
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    fontWeight: 300,
                    color: "#A09890",
                    fontStyle: "italic",
                  }}
                >
                  reading…
                </span>
              )}
              {job.state === "ready" && (
                <div
                  className="anim-fade-in"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <CheckCircleSmall />
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#1A3A2F",
                    }}
                  >
                    Ready
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CTA when all ready */}
      {allReady && (
        <div className="anim-fade-up">
          <button
            onClick={onFinish}
            style={{
              padding: "15px 32px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 5,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              letterSpacing: "0.2px",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Enter your workspace →
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 4 — Transition
   ────────────────────────────────────────────────────────────── */
export function ScreenTransition({ onEnterWorkspace }: { onEnterWorkspace: () => void }) {
  return (
    <div
      className="flex flex-col gap-10 anim-fade-up"
      style={{ animationDuration: "0.9s" }}
    >
      <div>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 10,
            fontWeight: 500,
            color: "#A09890",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          You&apos;re set up
        </p>
        <h2
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: 58,
            fontWeight: 500,
            fontStyle: "italic",
            color: "#1A1A1A",
            lineHeight: 1.02,
            letterSpacing: "-0.4px",
          }}
        >
          Let&apos;s get you
          <br />
          interviews.
        </h2>
      </div>
      <p
        style={{
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 18,
          fontWeight: 300,
          color: "#52493F",
          lineHeight: 1.65,
          maxWidth: 400,
          textWrap: "pretty",
        }}
      >
        Searchly has your background and knows the roles you want. Your workspace is ready.
      </p>

      {/* Workspace preview */}
      <div
        className="anim-fade-up"
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05), 0 14px 36px rgba(0,0,0,0.08)",
          animationDelay: "0.35s",
        }}
      >
        <div
          style={{
            background: "#1A3A2F",
            padding: "20px 30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-playfair), serif",
                fontSize: 16,
                fontWeight: 400,
                color: "#E8D5A3",
              }}
            >
              Searchly
            </span>
            <span
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                fontWeight: 300,
                color: "rgba(232,213,163,0.45)",
              }}
            >
              workspace
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              fontWeight: 400,
              color: "rgba(232,213,163,0.55)",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
            }}
          >
            3 roles tracked
          </span>
        </div>
        <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", gap: 9 }}>
          {[
            { role: "Senior PM · Stripe", match: "Resume match: 91%", status: "Draft ready", ready: true },
            { role: "Product Lead · Linear", match: "Resume match: 87%", status: "Draft ready", ready: true },
            { role: "Design Systems PM · Figma", match: "Tailoring…", status: "In progress", ready: false },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "13px 18px",
                background: "#F8F6F2",
                borderRadius: 7,
                opacity: row.ready ? 1 : 0.5,
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1A1A1A",
                    marginBottom: 2,
                  }}
                >
                  {row.role}
                </p>
                <p
                  className={row.ready ? "" : "anim-pulse"}
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: 300,
                    color: "#A09890",
                  }}
                >
                  {row.match}
                </p>
              </div>
              <span
                style={{
                  padding: "4px 11px",
                  background: row.ready ? "rgba(26,58,47,0.08)" : "rgba(0,0,0,0.05)",
                  borderRadius: 100,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  fontWeight: row.ready ? 500 : 400,
                  color: row.ready ? "#1A3A2F" : "#A09890",
                }}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="anim-fade-up" style={{ animationDelay: "0.65s" }}>
        <button
          onClick={onEnterWorkspace}
          style={{
            display: "inline-block",
            padding: "16px 36px",
            background: "#1A3A2F",
            color: "#E8D5A3",
            border: "none",
            borderRadius: 5,
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            letterSpacing: "0.2px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Get Interviews →
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Demo nav button (bottom-right)
   ────────────────────────────────────────────────────────────── */
export function DemoNextButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 100 }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          padding: "10px 20px",
          background: hover ? "#1A3A2F" : "rgba(26,58,47,0.9)",
          color: "rgba(232,213,163,0.88)",
          border: "none",
          borderRadius: 6,
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          letterSpacing: "0.3px",
          backdropFilter: "blur(8px)",
          transition: "background 0.15s",
        }}
      >
        Demo: next →
      </button>
    </div>
  );
}
