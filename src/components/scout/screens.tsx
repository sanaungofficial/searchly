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

const ONBOARDING_STEP_COUNT = 5;

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
  fontFamily: "var(--font-cormorant), Georgia, serif",
  fontSize: "clamp(2.25rem, 9vw, 3.5rem)",
  fontWeight: 500,
  fontStyle: "italic",
  color: "#1A1A1A",
  lineHeight: 1.03,
  letterSpacing: "-0.3px",
};

const DISPLAY_H2: React.CSSProperties = {
  fontFamily: "var(--font-cormorant), Georgia, serif",
  fontSize: "clamp(1.875rem, 8vw, 3.125rem)",
  fontWeight: 500,
  fontStyle: "italic",
  color: "#1A1A1A",
  lineHeight: 1.05,
  letterSpacing: "-0.2px",
};

const ONBOARDING_BODY: React.CSSProperties = {
  fontFamily: "var(--font-dm-sans), system-ui",
  fontSize: "clamp(1rem, 2.5vw, 1.125rem)",
  fontWeight: 300,
  color: "#52493F",
  lineHeight: 1.7,
  textWrap: "pretty",
};

const ONBOARDING_CARD_PAD = "clamp(18px, 4vw, 40px)";
const ONBOARDING_SECTION_PAD = "clamp(16px, 4vw, 24px)";

const PRIMARY_CTA: React.CSSProperties = {
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
};

export function ScoutHeader({ screen, onScoutClick }: { screen: Screen; onScoutClick?: () => void }) {
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
          title={onScoutClick ? "Go to workspace" : undefined}
        >
          Kimchi
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
                fontFamily: "var(--font-dm-sans), system-ui",
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
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  fontWeight: 300,
                  color: "#A09890",
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
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  fontWeight: 300,
                  color: "#A09890",
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
          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#C0392B", marginTop: 10, fontWeight: 300 }}>
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
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 11,
            fontWeight: 400,
            color: "#A09890",
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
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 10,
            fontWeight: 500,
            color: "#A09890",
            letterSpacing: "1px",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          LinkedIn <span style={{ fontWeight: 300, letterSpacing: 0, textTransform: "none" }}>(optional)</span>
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
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 16,
              fontWeight: 400,
              color: "#1A1A1A",
              caretColor: "#1A3A2F",
            }}
          />
        </div>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 12,
            fontWeight: 300,
            color: "#A09890",
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
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 13,
          fontWeight: 400,
          color: "#A09890",
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

      {/* Skip link */}
      {!liSubmitting && (
        <button
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 13,
            fontWeight: 400,
            color: "#A09890",
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
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 10,
            fontWeight: 500,
            color: "#A09890",
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
            <>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, color: "#6B6258", lineHeight: 1.6, marginBottom: 16 }}>
                We couldn&apos;t generate a profile read right now — that&apos;s okay. You can fill in your profile in the next steps.
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
                  fontFamily: "var(--font-dm-sans), system-ui",
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

      {/* Follow-up + CTA — only when readback loaded successfully */}
      {!loading && data && !error && (
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

      {/* Skip link — always visible */}
      {!allReady && (
        <button
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 13,
            fontWeight: 400,
            color: "#A09890",
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
    <div className="flex flex-col gap-8 onboarding-screen-gap">
      <div className="anim-fade-up" style={{ animationDelay: "0.1s" }}>
        <h2
          style={{
            ...DISPLAY_H2,
            lineHeight: 1.04,
            marginBottom: 14,
          }}
        >
          What roles are you targeting?
        </h2>
        <p
          style={{
            ...ONBOARDING_BODY,
            fontSize: "clamp(0.9375rem, 2.5vw, 1rem)",
            lineHeight: 1.65,
            maxWidth: 440,
          }}
        >
          Pick a category, then choose up to 3 specific titles.
        </p>
      </div>

      {/* Bucket chips */}
      <div className="anim-fade-up" style={{ animationDelay: "0.35s", background: "#FFFFFF", borderRadius: 12, padding: ONBOARDING_SECTION_PAD, border: "1px solid rgba(0,0,0,0.07)" }}>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 10,
            fontWeight: 500,
            color: "#A09890",
            letterSpacing: "1px",
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
                  background: active ? "#1A3A2F" : "transparent",
                  color: active ? "#E8D5A3" : "#52493F",
                  border: `1.5px solid ${active ? "#1A3A2F" : "rgba(26,58,47,0.22)"}`,
                  borderRadius: 6,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
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
        <div className="anim-fade-up" style={{ background: "#FFFFFF", borderRadius: 12, padding: ONBOARDING_SECTION_PAD, border: "1px solid rgba(0,0,0,0.07)" }}>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              fontWeight: 500,
              color: "#A09890",
              letterSpacing: "1px",
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
                    padding: "8px 16px",
                    background: selected ? "rgba(26,58,47,0.1)" : "transparent",
                    color: disabled ? "#C5BFB7" : selected ? "#1A3A2F" : "#52493F",
                    border: `1.5px solid ${selected ? "#1A3A2F" : disabled ? "rgba(26,58,47,0.1)" : "rgba(26,58,47,0.2)"}`,
                    borderRadius: 100,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 13,
                    fontWeight: selected ? 500 : 400,
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
        <div className="anim-fade-up">
          <button
            className="onboarding-cta"
            onClick={onContinue}
            style={PRIMARY_CTA}
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
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 13,
            fontWeight: 400,
            color: "#A09890",
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
   Screen 2 — About You
   ────────────────────────────────────────────────────────────── */
interface AboutYouProps {
  careerMotivation: string;
  jobTimeline: string;
  currentSalary: string;
  targetSalary: string;
  priorities: string[];
  attribution: string;
  onCareerMotivationChange: (v: string) => void;
  onJobTimelineChange: (v: string) => void;
  onCurrentSalaryChange: (v: string) => void;
  onTargetSalaryChange: (v: string) => void;
  onTogglePriority: (p: string) => void;
  onAttributionChange: (v: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function ScreenAboutYou({
  careerMotivation,
  jobTimeline,
  currentSalary,
  targetSalary,
  priorities,
  attribution,
  onCareerMotivationChange,
  onJobTimelineChange,
  onCurrentSalaryChange,
  onTargetSalaryChange,
  onTogglePriority,
  onAttributionChange,
  onContinue,
  onSkip,
}: AboutYouProps) {
  const salaryRows = [
    { label: "Current salary", value: currentSalary, onChange: onCurrentSalaryChange },
    { label: "Target salary", value: targetSalary, onChange: onTargetSalaryChange },
  ];

  const chipBtn = (selected: boolean, onClick: () => void, label: string) => (
    <button
      key={label}
      className="onboarding-chip"
      onClick={onClick}
      style={{
        padding: "8px 16px",
        background: selected ? "rgba(26,58,47,0.1)" : "transparent",
        color: selected ? "#1A3A2F" : "#52493F",
        border: `1.5px solid ${selected ? "#1A3A2F" : "rgba(26,58,47,0.2)"}`,
        borderRadius: 100,
        fontFamily: "var(--font-dm-sans), system-ui",
        fontSize: 13,
        fontWeight: selected ? 500 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap" as const,
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = "rgba(26,58,47,0.4)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = "rgba(26,58,47,0.2)"; }}
    >
      {label}
    </button>
  );

  const sectionLabel = (text: string, hint?: string, optional?: boolean) => (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 500, color: "#A09890", letterSpacing: "1px", textTransform: "uppercase" as const }}>
        {text}{optional && <span style={{ fontWeight: 300, letterSpacing: 0, textTransform: "none" as const }}> (optional)</span>}
      </p>
      {hint && (
        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "#A09890", marginTop: 6, lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-8 onboarding-screen-gap">
      <div className="anim-fade-up" style={{ animationDelay: "0.1s" }}>
        <h2 style={{ ...DISPLAY_H2, lineHeight: 1.04, marginBottom: 14 }}>
          A few more things.
        </h2>
        <p style={{ ...ONBOARDING_BODY, fontSize: "clamp(0.9375rem, 2.5vw, 1rem)", lineHeight: 1.65, maxWidth: 440 }}>
          Two quick picks help Kimchi rank opportunities and skip bad fits. Salary and the rest are optional.
        </p>
      </div>

      {/* Career motivation */}
      <div className="anim-fade-up" style={{ animationDelay: "0.2s", background: "#FFFFFF", borderRadius: 12, padding: ONBOARDING_SECTION_PAD, border: "1px solid rgba(0,0,0,0.07)" }}>
        {sectionLabel("What's driving your move?", "Surfaces roles that match why you're leaving — not just your title.")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CAREER_MOTIVATIONS.map((m) => chipBtn(careerMotivation === m, () => onCareerMotivationChange(careerMotivation === m ? "" : m), m))}
        </div>
      </div>

      {/* Job timeline */}
      <div className="anim-fade-up" style={{ animationDelay: "0.35s", background: "#FFFFFF", borderRadius: 12, padding: ONBOARDING_SECTION_PAD, border: "1px solid rgba(0,0,0,0.07)" }}>
        {sectionLabel("When do you want to make a move?", "Helps Kimchi prioritize urgent openings vs. long-shots.")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {JOB_TIMELINES.map(({ value, label }) => {
            const selected = jobTimeline === value;
            return (
              <button
                key={value}
                className="onboarding-chip"
                onClick={() => onJobTimelineChange(selected ? "" : value)}
                style={{
                  padding: "12px 18px",
                  background: selected ? "#1A3A2F" : "transparent",
                  color: selected ? "#E8D5A3" : "#52493F",
                  border: `1.5px solid ${selected ? "#1A3A2F" : "rgba(26,58,47,0.22)"}`,
                  borderRadius: 6,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 14,
                  fontWeight: selected ? 500 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "left" as const,
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = "rgba(26,58,47,0.5)"; }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = "rgba(26,58,47,0.22)"; }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Salary dropdowns */}
      <div className="anim-fade-up" style={{ animationDelay: "0.5s", background: "#FFFFFF", borderRadius: 12, padding: ONBOARDING_SECTION_PAD, border: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {salaryRows.map(({ label, value, onChange }) => (
            <div key={label} style={{ flex: "1 1 200px" }}>
              {sectionLabel(label, undefined, true)}
              <div style={{ position: "relative" }}>
                <select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  style={{ width: "100%", minHeight: 48, padding: "11px 36px 11px 14px", border: "1.5px solid rgba(26,58,47,0.22)", borderRadius: 6, background: "#F7F5F2", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 16, fontWeight: 400, color: value ? "#1A1A1A" : "#A09890", cursor: "pointer", appearance: "none", outline: "none", boxSizing: "border-box" }}
                >
                  <option value="">Select a range</option>
                  {SALARY_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <svg style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="12" height="7" viewBox="0 0 12 7" fill="none">
                  <path d="M1 1L6 6L11 1" stroke="#A09890" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priorities */}
      <div className="anim-fade-up" style={{ animationDelay: "0.65s", background: "#FFFFFF", borderRadius: 12, padding: ONBOARDING_SECTION_PAD, border: "1px solid rgba(0,0,0,0.07)" }}>
        {sectionLabel("What matters most to you?", "Filters listings that clash with how you want to work.", true)}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PRIORITIES.map((p) => chipBtn(priorities.includes(p), () => onTogglePriority(p), p))}
        </div>
      </div>

      {/* Attribution */}
      <div className="anim-fade-up" style={{ animationDelay: "0.8s", background: "#FFFFFF", borderRadius: 12, padding: ONBOARDING_SECTION_PAD, border: "1px solid rgba(0,0,0,0.07)" }}>
        {sectionLabel("How did you hear about Kimchi?", undefined, true)}
        <div style={{ position: "relative", maxWidth: 280, width: "100%" }}>
          <select
            value={attribution}
            onChange={(e) => onAttributionChange(e.target.value)}
            style={{ width: "100%", minHeight: 48, padding: "11px 36px 11px 14px", border: "1.5px solid rgba(26,58,47,0.22)", borderRadius: 6, background: "#F7F5F2", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 16, fontWeight: 400, color: attribution ? "#1A1A1A" : "#A09890", cursor: "pointer", appearance: "none", outline: "none", boxSizing: "border-box" }}
          >
            <option value="">Select one</option>
            {ATTRIBUTION_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <svg style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="12" height="7" viewBox="0 0 12 7" fill="none">
            <path d="M1 1L6 6L11 1" stroke="#A09890" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* CTA */}
      <div className="anim-fade-up" style={{ animationDelay: "0.95s" }}>
        <button
          className="onboarding-cta"
          onClick={onContinue}
          style={PRIMARY_CTA}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Continue →
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            display: "block",
            marginTop: 16,
            background: "none",
            border: "none",
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 13,
            fontWeight: 400,
            color: "#A09890",
            cursor: "pointer",
            padding: "8px 0",
            minHeight: 44,
            textAlign: "left",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Skip for now — you can add this on your profile later
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 3 — Transition
   ────────────────────────────────────────────────────────────── */
export function ScreenTransition({ onEnterWorkspace, targetRoles = [] }: { onEnterWorkspace: () => void; targetRoles?: string[] }) {
  const previewRoles = (targetRoles.length > 0 ? targetRoles : ["Director of Strategy", "VP of Operations"]).slice(0, 2);

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
        Kimchi has your background{targetRoles.length > 0 ? " and target roles" : ""}. Next: paste a job you&apos;re considering — I&apos;ll score how well you fit.
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
              Kimchi
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
            Next step
          </span>
        </div>
        <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", gap: 9 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 18px",
              background: "rgba(26,58,47,0.08)",
              borderRadius: 7,
              border: "1px solid rgba(26,58,47,0.12)",
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#1A3A2F",
                  marginBottom: 2,
                }}
              >
                Paste a job URL
              </p>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  fontWeight: 300,
                  color: "#6B6258",
                }}
              >
                Get a fit score and tailored materials
              </p>
            </div>
            <span
              style={{
                padding: "4px 11px",
                background: "#1A3A2F",
                borderRadius: 100,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                fontWeight: 500,
                color: "#E8D5A3",
              }}
            >
              Start here
            </span>
          </div>
          {previewRoles.map((role, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "13px 18px",
                background: "#F8F6F2",
                borderRadius: 7,
                opacity: i === 0 ? 1 : 0.6,
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
                  {role}
                </p>
                <p
                  className="anim-pulse"
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: 300,
                    color: "#A09890",
                  }}
                >
                  {i === 0 ? "Target role saved" : "Target role saved"}
                </p>
              </div>
              <span
                style={{
                  padding: "4px 11px",
                  background: "rgba(0,0,0,0.05)",
                  borderRadius: 100,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  fontWeight: 400,
                  color: "#A09890",
                }}
              >
                Saved
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="anim-fade-up" style={{ animationDelay: "0.65s" }}>
        <button
          className="onboarding-cta"
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
            minHeight: 48,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Add your first job →
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
