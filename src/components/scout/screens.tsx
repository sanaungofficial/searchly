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
export type Screen = 0 | 1 | 2 | 3 | 4 | 5;

const ONBOARDING_STEP_COUNT = 6;

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

const DISPLAY_H1: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(2.25rem, 9vw, 3.5rem)",
  fontWeight: 500,
  fontStyle: "italic",
  color: "#1A1A1A",
  lineHeight: 1.03,
  letterSpacing: "-0.3px",
};

const DISPLAY_H2: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.875rem, 8vw, 3.125rem)",
  fontWeight: 500,
  fontStyle: "italic",
  color: "#1A1A1A",
  lineHeight: 1.05,
  letterSpacing: "-0.2px",
};

const ONBOARDING_BODY: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "clamp(1rem, 2.5vw, 1.125rem)",
  fontWeight: 400,
  color: "#52493F",
  lineHeight: 1.7,
  textWrap: "pretty",
};

const ONBOARDING_CARD_PAD = "clamp(18px, 4vw, 40px)";
const ONBOARDING_SECTION_PAD = "clamp(16px, 4vw, 24px)";

const ONBOARDING_CARD: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  padding: ONBOARDING_SECTION_PAD,
  border: "1px solid rgba(26,58,47,0.14)",
  boxShadow: "0 2px 10px rgba(26,58,47,0.06)",
};

const ONBOARDING_FIELD_BG = "#F7F5F2";
const ONBOARDING_FIELD_BORDER = "1.5px solid rgba(26,58,47,0.2)";
const ONBOARDING_TEXT = "#1A1A1A";
const ONBOARDING_TEXT_SECONDARY = "#52493F";
const ONBOARDING_LABEL_COLOR = "#2A2218";

const PRIMARY_CTA: React.CSSProperties = {
  padding: "14px 30px",
  background: "#1A3A2F",
  color: "#E8D5A3",
  border: "none",
  borderRadius: 5,
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  letterSpacing: "0.2px",
  transition: "opacity 0.15s",
};

export function ScoutHeader({ screen, onScoutClick }: { screen: Screen; onScoutClick?: () => void }) {
  const logoTitle = onScoutClick ? "Go to workspace" : "Finish setup first";
  return (
    <div
      className="w-full max-w-[720px] flex justify-between items-start onboarding-header"
      style={{ paddingTop: "clamp(24px, 6vw, 40px)", paddingBottom: 0 }}
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
          title={logoTitle}
        >
          Kimchi
        </button>
        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--scout-muted)",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          by Second Ladder
        </div>
      </div>
      <div className="flex gap-[5px] items-center" style={{ paddingTop: 6 }}>
        {Array.from({ length: ONBOARDING_STEP_COUNT }, (_, i) => i).map((i) => (
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
  resumeError?: boolean;
  isDragging: boolean;
  liInput: string;
  onLIChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLIKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onContinue: () => void;
  onLinkedInOnly: () => void;
  onSkip: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ScreenWelcome({
  resumeFilename,
  resumeUploaded,
  resumeError,
  isDragging,
  liInput,
  onLIChange,
  onLIKey,
  onContinue,
  onLinkedInOnly,
  onSkip,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileClick,
  onFileChange,
}: WelcomeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropBorder = resumeError ? "#C0392B" : isDragging ? "#1A3A2F" : "rgba(26,58,47,0.22)";
  const dropBg = resumeError ? "rgba(192,57,43,0.04)" : isDragging ? "rgba(26,58,47,0.04)" : "transparent";
  const canContinueWithResume = resumeUploaded;
  const canSaveLinkedInOnly = liInput.trim().length > 0 && !resumeUploaded;

  return (
    <div className="flex flex-col gap-[28px] onboarding-screen-gap">
      <h1
        className="anim-fade-up"
        style={{
          ...DISPLAY_H1,
          animationDelay: "0.1s",
        }}
      >
        Hello. I&apos;m Kimchi.
      </h1>
      <p
        className="anim-fade-up"
        style={{
          ...ONBOARDING_BODY,
          maxWidth: 460,
          animationDelay: "0.4s",
        }}
      >
        Drop your resume and I&apos;ll read it — then I&apos;ll tell you what I see about your career.
      </p>

      {/* Upload zone */}
      <div className="anim-fade-up" style={{ animationDelay: "0.75s" }}>
        {!resumeFilename ? (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={onFileClick}
            style={{
              border: `1.5px dashed ${dropBorder}`,
              borderRadius: 10,
              padding: ONBOARDING_CARD_PAD,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
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
                  fontFamily: "var(--font-ui)",
                  fontSize: 15,
                  fontWeight: 400,
                  color: "#2E2820",
                }}
              >
                Drop your resume here
              </span>
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--scout-muted)",
                }}
              >
                PDF or DOCX · click to browse
              </span>
            </div>
          </div>
        ) : (
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
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 500,
                color: "#1A3A2F",
                flex: 1,
              }}
            >
              {resumeFilename}
            </span>
            {!resumeUploaded ? (
              <span
                className="anim-pulse"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--scout-muted)",
                }}
              >
                Reading…
              </span>
            ) : (
              <button
                onClick={onFileClick}
                style={{
                  background: "none",
                  border: "none",
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--scout-muted)",
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                Change
              </button>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
        {resumeError && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#C0392B", marginTop: 10, fontWeight: 400 }}>
            Upload failed — please try again or paste your LinkedIn below.
          </p>
        )}
      </div>

      {/* Or divider */}
      <div
        className="anim-fade-up"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          animationDelay: "0.9s",
        }}
      >
        <div style={{ flex: 1, height: 1, background: "rgba(26,58,47,0.12)" }} />
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--scout-muted)",
            letterSpacing: "0.5px",
          }}
        >
          or
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(26,58,47,0.12)" }} />
      </div>

      {/* LinkedIn input — saved to profile only; does not power readback */}
      <div className="anim-fade-up" style={{ animationDelay: "1.0s" }}>
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--scout-muted)",
            letterSpacing: "1px",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          LinkedIn <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>(optional)</span>
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1.5px solid rgba(26,58,47,0.22)",
            paddingBottom: 12,
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
              fontFamily: "var(--font-ui)",
              fontSize: 16,
              fontWeight: 400,
              color: "#1A1A1A",
              caretColor: "#1A3A2F",
            }}
          />
        </div>
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            fontWeight: 400,
            color: "var(--scout-muted)",
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          We&apos;ll save this on your profile. Kimchi&apos;s read comes from your resume, not LinkedIn.
        </p>
      </div>

      {/* Continue after resume upload → readback */}
      {canContinueWithResume && (
        <div className="anim-fade-up">
          <button
            className="onboarding-cta"
            onClick={onContinue}
            style={PRIMARY_CTA}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            See what Kimchi read →
          </button>
        </div>
      )}

      {canSaveLinkedInOnly && (
        <div className="anim-fade-up">
          <button
            type="button"
            className="onboarding-cta"
            onClick={onLinkedInOnly}
            style={{
              ...PRIMARY_CTA,
              background: "transparent",
              color: "#52493F",
              border: "1.5px solid rgba(26,58,47,0.22)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(26,58,47,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Save LinkedIn &amp; continue without resume
          </button>
        </div>
      )}

      {/* Skip link */}
      <button
        onClick={onSkip}
        style={{
          background: "none",
          border: "none",
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          fontWeight: 400,
          color: "var(--scout-muted)",
          cursor: "pointer",
          padding: "8px 0",
          minHeight: 44,
          textAlign: "left",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        Skip for now
      </button>
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
  onSkip: () => void;
}

export function ScreenLinkedIn({
  resumeFilename,
  liInput,
  liSubmitting,
  onSkip,
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
            fontFamily: "var(--font-ui)",
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
          fontFamily: "var(--font-display)",
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
          fontFamily: "var(--font-ui)",
          fontSize: 17,
          fontWeight: 400,
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
                fontFamily: "var(--font-ui)",
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
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--scout-muted)",
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
              fontFamily: "var(--font-ui)",
              fontSize: 16,
              fontWeight: 400,
              color: "#52493F",
            }}
          >
            Analyzing your background…
          </p>
        </div>
      )}

      {/* Skip link */}
      {!liSubmitting && (
        <button
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 400,
            color: "var(--scout-muted)",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Skip for now
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 2 — The Read-Back
   ────────────────────────────────────────────────────────────── */
export interface ReadBackData {
  picture: string;
  strengths: string[];
  targetRoles: { role: string; fit: string }[];
  honestNote: string;
}

interface ReadBackProps {
  onConfirm: (data: ReadBackData | null) => void;
  onRefine: () => void;
  onSkip: () => void;
}

function fitColor(fit: string): string {
  if (fit === "Strong match") return "#4A8B6A";
  if (fit === "Good fit") return "#A89462";
  return "#8A7A6A";
}

export function ScreenReadBack({ onConfirm, onRefine, onSkip }: ReadBackProps) {
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
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--scout-muted)",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Kimchi&apos;s read
        </p>
        <h2
          style={{
            ...DISPLAY_H2,
            lineHeight: 1.04,
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
            padding: ONBOARDING_CARD_PAD,
            boxShadow: "0 2px 4px rgba(0,0,0,0.04), 0 10px 28px rgba(0,0,0,0.07)",
            minHeight: loading ? 320 : undefined,
          }}
        >
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, color: "var(--scout-muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
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
            <>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#6B6258", lineHeight: 1.6, marginBottom: 8 }}>
                We couldn&apos;t generate your read right now — that happens sometimes. You can keep going and add a job; upload a resume anytime from Profile → Assets for the full read.
              </p>
              <button
                type="button"
                onClick={onSkip}
                style={{
                  padding: "12px 22px",
                  background: "#1A3A2F",
                  color: "#E8D5A3",
                  border: "none",
                  borderRadius: 5,
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Continue →
              </button>
            </>
          )}

          {!loading && data && (
            <>
              <p
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--scout-muted)",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: 20,
                }}
              >
                A picture of you
              </p>

              <p
                style={{
                  fontFamily: "var(--font-display)",
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
                      fontFamily: "var(--font-ui)",
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
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--scout-muted)",
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
                          fontFamily: "var(--font-display)",
                          fontSize: 18,
                          fontWeight: 500,
                          color: "#1A1A1A",
                        }}
                      >
                        {r.role}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-ui)",
                          fontSize: 12,
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
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--scout-muted)",
                    letterSpacing: "0.9px",
                    textTransform: "uppercase",
                    marginBottom: 9,
                  }}
                >
                  One honest note
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 400,
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

      {/* Follow-up + CTA — only when readback loaded successfully */}
      {!loading && data && !error && (
      <div className="anim-fade-up" style={{ animationDelay: "0.85s" }}>
        <p
          style={{
            fontFamily: "var(--font-display)",
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
        <div className="onboarding-readback-actions">
          <button
            className="onboarding-cta"
            onClick={() => onConfirm(data)}
            style={PRIMARY_CTA}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Yes, carry on →
          </button>
          <button
            className="onboarding-cta"
            onClick={onRefine}
            style={{
              padding: "14px 24px",
              background: "transparent",
              color: "#52493F",
              border: "1px solid rgba(26,58,47,0.2)",
              borderRadius: 5,
              fontFamily: "var(--font-ui)",
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
      )}
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
  onSkip: () => void;
}

export function ScreenTargetJobs({
  jobInput,
  jobs,
  onJobChange,
  onJobKey,
  onAddJob,
  onFinish,
  onSkip,
}: TargetJobsProps) {
  const canAdd = jobs.length < 3;
  const allReady = jobs.length > 0 && jobs.every((j) => j.state === "ready");

  return (
    <div className="flex flex-col gap-8">
      <h2
        className="anim-fade-up"
        style={{
          fontFamily: "var(--font-display)",
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
          fontFamily: "var(--font-ui)",
          fontSize: 17,
          fontWeight: 400,
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
                fontFamily: "var(--font-ui)",
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
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 400,
              color: "var(--scout-muted)",
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
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
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
                    fontFamily: "var(--font-ui)",
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
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--scout-muted)",
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
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--scout-muted)",
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
                      fontFamily: "var(--font-ui)",
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
              fontFamily: "var(--font-ui)",
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

      {/* Skip link — always visible */}
      {!allReady && (
        <button
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 400,
            color: "var(--scout-muted)",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Skip for now — I'll add jobs from the workspace
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Role / preference data
   ────────────────────────────────────────────────────────────── */
export const ROLE_BUCKETS = [
  {
    id: "pm",
    label: "Product Management",
    titles: [
      "Product Manager",
      "Senior Product Manager",
      "Principal / Staff Product Manager",
      "Group Product Manager",
      "Director of Product Management",
      "VP of Product",
      "Head of Product",
      "Chief Product Officer (CPO)",
    ],
  },
  {
    id: "strategy",
    label: "Corporate Strategy / CorpDev",
    titles: [
      "Strategy Manager",
      "Senior Strategy Manager",
      "Director of Strategy",
      "VP of Corporate Strategy",
      "Head of Corporate Development",
      "Director of Corporate Development",
      "Chief Strategy Officer (CSO)",
      "Business Development Director",
      "Chief of Staff",
    ],
  },
  {
    id: "ops",
    label: "Operations / BizOps",
    titles: [
      "Business Operations Manager",
      "Director of Operations",
      "VP of Operations",
      "Chief Operating Officer (COO)",
      "Chief of Staff",
      "Head of BizOps",
      "General Manager",
      "Director of Program Management",
      "Transformation Director",
    ],
  },
  {
    id: "pevc",
    label: "PE / VC Operations",
    titles: [
      "Operating Partner",
      "Head of Portfolio Operations",
      "Portfolio Operations Manager",
      "Value Creation Manager",
      "Chief of Staff (PE/VC-backed)",
      "VP of Operations (PE-backed)",
    ],
  },
];

export const SALARY_RANGES = [
  "Under $100K",
  "$100K – $150K",
  "$150K – $200K",
  "$200K – $250K",
  "$250K – $300K",
  "$300K – $400K",
  "$400K+",
  "Prefer not to say",
];

const PRIORITIES = [
  "Remote-first",
  "Hybrid-friendly",
  "Work-life balance",
  "High compensation",
  "Equity / ownership",
  "Mission-driven",
  "Fast growth",
  "Strong team culture",
  "Specific location",
];

const CAREER_MOTIVATIONS = [
  "Higher compensation",
  "More interesting work",
  "Better work-life balance",
  "Step up in level",
  "A career pivot",
];

const JOB_TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "3-6mo", label: "In the next 3–6 months" },
  { value: "open", label: "Whenever the right role appears" },
];

const ATTRIBUTION_SOURCES = [
  "LinkedIn",
  "Twitter / X",
  "Google search",
  "Friend or colleague",
  "Newsletter",
  "YouTube",
  "Other",
];

/* ──────────────────────────────────────────────────────────────
   Screen 1 — Target Roles
   ────────────────────────────────────────────────────────────── */
interface TargetRolesProps {
  selectedBuckets: string[];
  selectedTitles: string[];
  onToggleBucket: (id: string) => void;
  onToggleTitle: (title: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function ScreenTargetRoles({
  selectedBuckets,
  selectedTitles,
  onToggleBucket,
  onToggleTitle,
  onContinue,
  onSkip,
}: TargetRolesProps) {
  const availableTitles = ROLE_BUCKETS
    .filter((b) => selectedBuckets.includes(b.id))
    .flatMap((b) => b.titles)
    .filter((t, i, arr) => arr.indexOf(t) === i);

  const canContinue = selectedTitles.length > 0;
  const atMax = selectedTitles.length >= 3;

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <AboutYouIntro
        title="What roles are you targeting?"
        body="Pick a category, then choose up to 3 specific titles. We'll use these when you add jobs and score your fit."
      />

      {/* Bucket chips */}
      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.35s" }}>
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 600,
            color: ONBOARDING_LABEL_COLOR,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Category
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ROLE_BUCKETS.map((b) => {
            const active = selectedBuckets.includes(b.id);
            return (
              <button
                key={b.id}
                className="onboarding-chip"
                onClick={() => onToggleBucket(b.id)}
                style={{
                  padding: "10px 18px",
                  background: active ? "#1A3A2F" : ONBOARDING_FIELD_BG,
                  color: active ? "#E8D5A3" : ONBOARDING_TEXT,
                  border: active ? "1.5px solid #1A3A2F" : ONBOARDING_FIELD_BORDER,
                  borderRadius: 8,
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  letterSpacing: "0.1px",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "rgba(26,58,47,0.5)";
                    e.currentTarget.style.color = "#1A1A1A";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.borderColor = "rgba(26,58,47,0.22)";
                    e.currentTarget.style.color = "#52493F";
                  }
                }}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Title chips — appear once a bucket is selected */}
      {availableTitles.length > 0 && (
        <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.45s" }}>
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 600,
              color: ONBOARDING_LABEL_COLOR,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            {atMax ? "Specific role · max 3 selected" : "Specific role · pick up to 3"}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {availableTitles.map((title) => {
              const selected = selectedTitles.includes(title);
              const disabled = !selected && atMax;
              return (
                <button
                  key={title}
                  className="onboarding-chip"
                  onClick={() => !disabled && onToggleTitle(title)}
                  style={{
                    padding: "10px 16px",
                    background: selected ? "rgba(26,58,47,0.12)" : ONBOARDING_FIELD_BG,
                    color: disabled ? "#A09890" : selected ? "#1A3A2F" : ONBOARDING_TEXT,
                    border: `1.5px solid ${selected ? "#1A3A2F" : disabled ? "rgba(26,58,47,0.12)" : "rgba(26,58,47,0.2)"}`,
                    borderRadius: 8,
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    fontWeight: selected ? 600 : 500,
                    cursor: disabled ? "default" : "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected && !disabled) e.currentTarget.style.borderColor = "rgba(26,58,47,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    if (!selected && !disabled) e.currentTarget.style.borderColor = "rgba(26,58,47,0.2)";
                  }}
                >
                  {title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Continue */}
      {canContinue && (
        <div className="anim-fade-up" style={ONBOARDING_CARD}>
          <button
            className="onboarding-cta"
            onClick={onContinue}
            style={{ ...PRIMARY_CTA, width: "100%" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Continue →
          </button>
        </div>
      )}

      {!canContinue && (
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 400,
            color: "var(--scout-muted)",
            cursor: "pointer",
            padding: "8px 0",
            minHeight: 44,
            textAlign: "left",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Skip for now
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 3–4 — About You (split for scroll)
   ────────────────────────────────────────────────────────────── */
function aboutYouChipBtn(selected: boolean, onClick: () => void, label: string) {
  return (
    <button
      key={label}
      className="onboarding-chip"
      onClick={onClick}
      style={{
        padding: "10px 16px",
        background: selected ? "rgba(26,58,47,0.12)" : ONBOARDING_FIELD_BG,
        color: selected ? "#1A3A2F" : ONBOARDING_TEXT,
        border: selected ? "1.5px solid #1A3A2F" : ONBOARDING_FIELD_BORDER,
        borderRadius: 8,
        fontFamily: "var(--font-ui)",
        fontSize: 14,
        fontWeight: selected ? 600 : 500,
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap" as const,
        boxShadow: selected ? "inset 0 0 0 1px rgba(26,58,47,0.08)" : "none",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = "rgba(26,58,47,0.45)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = "rgba(26,58,47,0.2)"; }}
    >
      {label}
    </button>
  );
}

function aboutYouSectionLabel(text: string, hint?: string, optional?: boolean) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: ONBOARDING_LABEL_COLOR, letterSpacing: "0.6px", textTransform: "uppercase" as const }}>
        {text}{optional && <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: "none" as const, color: ONBOARDING_TEXT_SECONDARY }}> (optional)</span>}
      </p>
      {hint && (
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 400, color: ONBOARDING_TEXT_SECONDARY, marginTop: 6, lineHeight: 1.55 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

const ABOUT_YOU_SKIP_LINK: React.CSSProperties = {
  display: "block",
  marginTop: 16,
  background: "none",
  border: "none",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  fontWeight: 400,
  color: ONBOARDING_TEXT_SECONDARY,
  cursor: "pointer",
  padding: "8px 0",
  minHeight: 44,
  textAlign: "left",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

function AboutYouIntro({ title, body }: { title: string; body: string }) {
  return (
    <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.1s" }}>
      <h2 style={{ ...DISPLAY_H2, lineHeight: 1.04, marginBottom: 12 }}>{title}</h2>
      <p style={{ ...ONBOARDING_BODY, fontSize: "clamp(0.9375rem, 2.5vw, 1rem)", lineHeight: 1.65, margin: 0, color: ONBOARDING_TEXT_SECONDARY }}>
        {body}
      </p>
    </div>
  );
}

function AboutYouActions({ onContinue, onSkip, nudge }: { onContinue: () => void; onSkip: () => void; nudge?: string }) {
  return (
    <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.55s" }}>
      {nudge && (
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 400,
            color: ONBOARDING_TEXT_SECONDARY,
            lineHeight: 1.55,
            marginBottom: 16,
            marginTop: 0,
          }}
        >
          {nudge}
        </p>
      )}
      <button
        className="onboarding-cta"
        onClick={onContinue}
        style={{ ...PRIMARY_CTA, width: "100%" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        Continue →
      </button>
      <button type="button" onClick={onSkip} style={{ ...ABOUT_YOU_SKIP_LINK, color: ONBOARDING_TEXT_SECONDARY }}>
        Skip for now — you can add this on your profile later
      </button>
    </div>
  );
}

interface AboutYouSearchProps {
  careerMotivation: string;
  jobTimeline: string;
  onCareerMotivationChange: (v: string) => void;
  onJobTimelineChange: (v: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function ScreenAboutYouSearch({
  careerMotivation,
  jobTimeline,
  onCareerMotivationChange,
  onJobTimelineChange,
  onContinue,
  onSkip,
}: AboutYouSearchProps) {
  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <AboutYouIntro
        title="Your search."
        body="Two quick picks help Kimchi rank opportunities and skip bad fits."
      />

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.2s" }}>
        {aboutYouSectionLabel("What's driving your move?", "Surfaces roles that match why you're leaving — not just your title.")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CAREER_MOTIVATIONS.map((m) =>
            aboutYouChipBtn(careerMotivation === m, () => onCareerMotivationChange(careerMotivation === m ? "" : m), m)
          )}
        </div>
      </div>

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.35s" }}>
        {aboutYouSectionLabel("When do you want to make a move?", "Helps Kimchi prioritize urgent openings vs. long-shots.")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {JOB_TIMELINES.map(({ value, label }) => {
            const selected = jobTimeline === value;
            return (
              <button
                key={value}
                className="onboarding-chip"
                onClick={() => onJobTimelineChange(selected ? "" : value)}
                style={{
                  padding: "14px 18px",
                  background: selected ? "#1A3A2F" : ONBOARDING_FIELD_BG,
                  color: selected ? "#E8D5A3" : ONBOARDING_TEXT,
                  border: selected ? "1.5px solid #1A3A2F" : ONBOARDING_FIELD_BORDER,
                  borderRadius: 8,
                  fontFamily: "var(--font-ui)",
                  fontSize: 15,
                  fontWeight: selected ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "left" as const,
                  width: "100%",
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = "rgba(26,58,47,0.45)"; }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = "rgba(26,58,47,0.2)"; }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <AboutYouActions onContinue={onContinue} onSkip={onSkip} />
    </div>
  );
}

interface AboutYouPreferencesProps {
  jobTimeline: string;
  currentSalary: string;
  targetSalary: string;
  priorities: string[];
  attribution: string;
  onCurrentSalaryChange: (v: string) => void;
  onTargetSalaryChange: (v: string) => void;
  onTogglePriority: (p: string) => void;
  onAttributionChange: (v: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function ScreenAboutYouPreferences({
  jobTimeline,
  currentSalary,
  targetSalary,
  priorities,
  attribution,
  onCurrentSalaryChange,
  onTargetSalaryChange,
  onTogglePriority,
  onAttributionChange,
  onContinue,
  onSkip,
}: AboutYouPreferencesProps) {
  const salaryRows = [
    { label: "Current salary", value: currentSalary, onChange: onCurrentSalaryChange },
    { label: "Target salary", value: targetSalary, onChange: onTargetSalaryChange },
  ];
  const showFilterNudge = !jobTimeline && !targetSalary;
  const selectStyle = (hasValue: boolean): React.CSSProperties => ({
    width: "100%",
    minHeight: 48,
    padding: "11px 36px 11px 14px",
    border: ONBOARDING_FIELD_BORDER,
    borderRadius: 8,
    background: ONBOARDING_FIELD_BG,
    fontFamily: "var(--font-ui)",
    fontSize: 16,
    fontWeight: 500,
    color: hasValue ? ONBOARDING_TEXT : ONBOARDING_TEXT_SECONDARY,
    cursor: "pointer",
    appearance: "none",
    outline: "none",
    boxSizing: "border-box",
  });

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <AboutYouIntro
        title="Your preferences."
        body="All optional — helps Kimchi filter listings that clash with how you want to work."
      />

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.2s" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {salaryRows.map(({ label, value, onChange }) => (
            <div key={label} style={{ flex: "1 1 200px" }}>
              {aboutYouSectionLabel(label, undefined, true)}
              <div style={{ position: "relative" }}>
                <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle(!!value)}>
                  <option value="">Select a range</option>
                  {SALARY_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <svg style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="12" height="7" viewBox="0 0 12 7" fill="none">
                  <path d="M1 1L6 6L11 1" stroke={ONBOARDING_TEXT_SECONDARY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.35s" }}>
        {aboutYouSectionLabel("What matters most to you?", "Filters listings that clash with how you want to work.", true)}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PRIORITIES.map((p) => aboutYouChipBtn(priorities.includes(p), () => onTogglePriority(p), p))}
        </div>
      </div>

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.5s" }}>
        {aboutYouSectionLabel("How did you hear about Kimchi?", undefined, true)}
        <div style={{ position: "relative", maxWidth: 320, width: "100%" }}>
          <select value={attribution} onChange={(e) => onAttributionChange(e.target.value)} style={selectStyle(!!attribution)}>
            <option value="">Select one</option>
            {ATTRIBUTION_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <svg style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="12" height="7" viewBox="0 0 12 7" fill="none">
            <path d="M1 1L6 6L11 1" stroke={ONBOARDING_TEXT_SECONDARY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <AboutYouActions
        onContinue={onContinue}
        onSkip={onSkip}
        nudge={showFilterNudge ? "Adding a timeline and target salary helps Kimchi filter bad-fit roles — optional, but worth a quick pick." : undefined}
      />
    </div>
  );
}
/* ──────────────────────────────────────────────────────────────
   Screen 5 — Transition + first job
   ────────────────────────────────────────────────────────────── */
export interface TransitionJobAnalysis {
  company: string | null;
  role: string | null;
  location: string | null;
  salary: string | null;
  description: string | null;
  requirements: string[];
}

export interface TransitionJobMatch {
  score: number;
  scoreLabel: string;
  summaryNote: string;
}

function TransitionScoreGauge({ score }: { score: number }) {
  const color =
    score >= 8 ? "#4A8B6A" : score >= 6 ? "#C4A86A" : score >= 4 ? "#C4574A" : "#9B3A2A";
  const pct = Math.min(score / 10, 1);
  const r = 22;
  const circ = 2 * Math.PI * r;

  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="28" cy="28" r={r} stroke="rgba(0,0,0,0.08)" strokeWidth="5" fill="none" />
        <circle
          cx="28"
          cy="28"
          r={r}
          stroke={color}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 15,
            fontWeight: 700,
            color,
          }}
        >
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

interface TransitionProps {
  targetRoles?: string[];
  jobUrl: string;
  onJobUrlChange: (value: string) => void;
  onAnalyze: () => void;
  onTailorResume: () => void;
  onWriteCoverLetter: () => void;
  onAddJob: () => void;
  onSkip: () => void;
  onReviewProfile?: () => void;
  loading: boolean;
  loadingPhase?: "parse" | "match" | null;
  error: string | null;
  matchError: string | null;
  analysis: TransitionJobAnalysis | null;
  match: TransitionJobMatch | null;
}

export function ScreenTransition({
  targetRoles = [],
  jobUrl,
  onJobUrlChange,
  onAnalyze,
  onTailorResume,
  onWriteCoverLetter,
  onAddJob,
  onSkip,
  onReviewProfile,
  loading,
  loadingPhase = null,
  error,
  matchError,
  analysis,
  match,
}: TransitionProps) {
  const canAnalyze = jobUrl.trim().length > 0 && !loading;
  const scoreColor =
    match && match.score >= 8
      ? "#4A8B6A"
      : match && match.score >= 6
      ? "#C4A86A"
      : match && match.score >= 4
      ? "#C4574A"
      : "#9B3A2A";

  return (
    <div className="flex flex-col gap-5 anim-fade-up onboarding-screen-gap" style={{ animationDuration: "0.9s" }}>
      <div style={ONBOARDING_CARD}>
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 600,
            color: ONBOARDING_TEXT_SECONDARY,
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginBottom: 12,
            marginTop: 0,
          }}
        >
          You&apos;re set up
        </p>
        <h2 style={{ ...DISPLAY_H2, lineHeight: 1.02, marginBottom: 12 }}>
          Let&apos;s get you
          <br />
          interviews.
        </h2>
        <p style={{ ...ONBOARDING_BODY, fontSize: "clamp(1rem, 2.5vw, 1.125rem)", maxWidth: 440, margin: 0, color: ONBOARDING_TEXT_SECONDARY }}>
          Paste a job you&apos;re considering. Kimchi will read the listing and score your fit.
        </p>
      </div>

      {targetRoles.length > 0 && (
        <div className="anim-fade-up" style={ONBOARDING_CARD}>
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 600,
              color: ONBOARDING_LABEL_COLOR,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              marginBottom: 12,
              marginTop: 0,
            }}
          >
            Roles you&apos;re targeting
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {targetRoles.map((role) => (
              <span
                key={role}
                style={{
                  padding: "8px 14px",
                  background: ONBOARDING_FIELD_BG,
                  border: ONBOARDING_FIELD_BORDER,
                  borderRadius: 8,
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: ONBOARDING_TEXT,
                }}
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="anim-fade-up" style={ONBOARDING_CARD}>
        <p
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 600,
            color: ONBOARDING_LABEL_COLOR,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Add your first job
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="url"
            autoFocus
            placeholder="Paste a job listing URL…"
            value={jobUrl}
            onChange={(e) => onJobUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (analysis && match) onTailorResume();
                else if (analysis) onAddJob();
                else if (canAnalyze) onAnalyze();
              }
            }}
            style={{
              width: "100%",
              minHeight: 48,
              padding: "12px 14px",
              border: ONBOARDING_FIELD_BORDER,
              borderRadius: 8,
              background: ONBOARDING_FIELD_BG,
              fontFamily: "var(--font-ui)",
              fontSize: 16,
              fontWeight: 500,
              color: ONBOARDING_TEXT,
              boxSizing: "border-box",
            }}
          />
          {!analysis && (
            <button
              type="button"
              className="onboarding-cta"
              disabled={!canAnalyze}
              onClick={onAnalyze}
              style={{
                ...PRIMARY_CTA,
                opacity: canAnalyze ? 1 : 0.45,
                cursor: canAnalyze ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "Reading listing…" : "Analyze this job →"}
            </button>
          )}
        </div>

        {loading && (
          <p
            className="anim-pulse"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 400,
              color: "#52493F",
              marginTop: 14,
            }}
          >
            {loadingPhase === "match"
              ? "Scoring your fit against this role…"
              : "Kimchi is reading the listing…"}
          </p>
        )}

        {error && !loading && (
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              color: "#C4574A",
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>
        )}

        {analysis && !loading && (
          <div
            style={{
              marginTop: 16,
              padding: "16px 18px",
              background: ONBOARDING_FIELD_BG,
              borderRadius: 8,
              border: ONBOARDING_FIELD_BORDER,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 15,
                fontWeight: 600,
                color: "#1A1A1A",
                marginBottom: 4,
              }}
            >
              {analysis.company ?? "Company"}
            </p>
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 400,
                color: "#52493F",
                marginBottom: 10,
              }}
            >
              {analysis.role ?? "Role"}
            </p>
            {(analysis.location || analysis.salary) && (
              <p
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--scout-muted)",
                  marginBottom: match ? 16 : 14,
                }}
              >
                {[analysis.location, analysis.salary].filter(Boolean).join(" · ")}
              </p>
            )}

            {match && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "14px 16px",
                  marginBottom: 14,
                  background: "#FAF7F2",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#1A1A1A",
                      marginBottom: 6,
                      lineHeight: 1.35,
                    }}
                  >
                    Your resume is a{" "}
                    <span style={{ color: scoreColor }}>{match.scoreLabel}</span> match
                  </p>
                  {match.score < 6 ? (
                    <p
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        color: "#C4574A",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      Resumes under 6.0 are often filtered out — let&apos;s fix yours fast.
                    </p>
                  ) : match.score < 8 ? (
                    <p
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        color: "#52493F",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      Solid foundation. A few targeted tweaks could push you into strong match territory.
                    </p>
                  ) : (
                    <p
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        color: "#52493F",
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      You&apos;re a strong candidate for this role.
                    </p>
                  )}
                  {match.summaryNote && (
                    <p
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        fontWeight: 400,
                        color: "var(--scout-muted)",
                        lineHeight: 1.5,
                        marginTop: 8,
                        marginBottom: 0,
                      }}
                    >
                      {match.summaryNote}
                    </p>
                  )}
                </div>
                <TransitionScoreGauge score={match.score} />
              </div>
            )}

            {matchError && !match && (
              <p
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  color: "var(--scout-muted)",
                  lineHeight: 1.5,
                  marginBottom: 14,
                }}
              >
                {matchError}
              </p>
            )}

            {match ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  className="onboarding-cta"
                  onClick={onTailorResume}
                  style={PRIMARY_CTA}
                >
                  Tailor my resume →
                </button>
                <button
                  type="button"
                  onClick={onWriteCoverLetter}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: "11px 16px",
                    background: "#FFFFFF",
                    border: "1.5px solid rgba(26,58,47,0.22)",
                    borderRadius: 6,
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#1A3A2F",
                    cursor: "pointer",
                  }}
                >
                  Write cover letter
                </button>
                <button
                  type="button"
                  onClick={onAddJob}
                  style={{
                    background: "none",
                    border: "none",
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    color: "var(--scout-muted)",
                    cursor: "pointer",
                    padding: "6px 0",
                    textAlign: "center",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Save to pipeline only
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="onboarding-cta"
                onClick={onAddJob}
                style={PRIMARY_CTA}
              >
                Add to my pipeline →
              </button>
            )}
          </div>
        )}
      </div>

      <div className="anim-fade-up">
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 400,
            color: "var(--scout-muted)",
            cursor: "pointer",
            padding: "8px 0",
            minHeight: 44,
            textAlign: "left",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          I&apos;ll add a job later — take me to my workspace
        </button>
        {onReviewProfile && (
          <button
            type="button"
            onClick={onReviewProfile}
            style={{
              display: "block",
              background: "none",
              border: "none",
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 400,
              color: "var(--scout-muted)",
              cursor: "pointer",
              padding: "8px 0",
              minHeight: 44,
              textAlign: "left",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Review your profile
          </button>
        )}
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
          fontFamily: "var(--font-ui)",
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
