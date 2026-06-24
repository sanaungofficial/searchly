"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { JobBoardId } from "@/lib/job-board-search";
import { buildJobBoardLinks } from "@/lib/job-board-search";
import {
  mergeRoleSuggestions,
  normalizeCustomRoleTitle,
  TARGET_ROLE_SUGGESTIONS,
} from "@/lib/target-roles";
import { ONBOARDING_COMPANY_PICKS, ONBOARDING_MAX_TARGET_COMPANIES } from "@/lib/company-catalog";
import { CompanyLogo } from "@/components/scout/company-logo";
import {
  UploadIcon,
  CheckCircleFilled,
  CheckCircleSmall,
  CheckCircleTiny,
  LinkedInIcon,
  IndeedIcon,
  GoogleIcon,
  ArrowRightIcon,
  ArrowRightSmall,
  ClockIcon,
} from "./icons";
import { KimchiBySecondLadder } from "./scout-box";
import { ScoreExplainerPopover } from "./score-explainer-popover";

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */
export type Screen = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

const ONBOARDING_STEP_COUNT = 7;

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
  borderRadius: 0,
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
  borderRadius: 0,
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  letterSpacing: "0.2px",
  transition: "opacity 0.15s",
};

function OnboardingHeroIntro({ title, body }: { title: string; body: string }) {
  return (
    <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.1s" }}>
      <h1 style={{ ...DISPLAY_H1, lineHeight: 1.03, marginBottom: 12 }}>{title}</h1>
      <p style={{ ...ONBOARDING_BODY, margin: 0, maxWidth: 460, color: ONBOARDING_TEXT_SECONDARY }}>{body}</p>
    </div>
  );
}

function OnboardingEyebrowIntro({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  return (
    <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.1s" }}>
      {eyebrow && (
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
          {eyebrow}
        </p>
      )}
      <h2 style={{ ...DISPLAY_H2, lineHeight: 1.04, marginBottom: body ? 12 : 0 }}>{title}</h2>
      {body && (
        <p style={{ ...ONBOARDING_BODY, margin: 0, color: ONBOARDING_TEXT_SECONDARY, fontSize: "clamp(0.9375rem, 2.5vw, 1rem)", lineHeight: 1.65 }}>
          {body}
        </p>
      )}
    </div>
  );
}

const ONBOARDING_SKIP_LINK: React.CSSProperties = {
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

function OnboardingActions({
  children,
  skipLabel,
  onSkip,
}: {
  children: React.ReactNode;
  skipLabel?: string;
  onSkip?: () => void;
}) {
  return (
    <div className="anim-fade-up" style={ONBOARDING_CARD}>
      {children}
      {skipLabel && onSkip && (
        <button type="button" onClick={onSkip} style={ONBOARDING_SKIP_LINK}>
          {skipLabel}
        </button>
      )}
    </div>
  );
}

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
            fontFamily: "var(--font-display)",
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
        <KimchiBySecondLadder fontSize={12} color="var(--scout-muted)" marginTop={4} />
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

const RESUME_UPLOAD_MESSAGES = [
  "Uploading your file…",
  "Extracting text from your resume…",
  "Organizing your experience…",
  "Building your profile…",
  "Almost there…",
];

function ResumeReadingProgress({ filename }: { filename: string }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    setMessageIndex(0);
    const id = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % RESUME_UPLOAD_MESSAGES.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, [filename]);

  return (
    <div
      className="anim-fade-in"
      role="status"
      aria-live="polite"
      aria-label="Reading your resume"
      style={{
        padding: "20px 18px",
        background: ONBOARDING_FIELD_BG,
        border: ONBOARDING_FIELD_BORDER,
        borderRadius: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div
          className="anim-spin"
          style={{
            width: 22,
            height: 22,
            marginTop: 2,
            border: "2px solid rgba(26,58,47,0.15)",
            borderTopColor: "#1A3A2F",
            borderRadius: "50%",
            flexShrink: 0,
          }}
          aria-hidden
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: 600,
              color: ONBOARDING_TEXT,
              margin: "0 0 6px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {filename}
          </p>
          <p
            key={messageIndex}
            className="anim-fade-in"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: 500,
              color: "#1A3A2F",
              margin: "0 0 8px",
              lineHeight: 1.45,
            }}
          >
            {RESUME_UPLOAD_MESSAGES[messageIndex]}
          </p>
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 400,
              color: ONBOARDING_TEXT_SECONDARY,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Kimchi is reading your resume — this usually takes 10–20 seconds.
          </p>
        </div>
      </div>
      <div className="onboarding-upload-progress" aria-hidden>
        <div className="onboarding-upload-progress__bar" />
      </div>
    </div>
  );
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
  const dropBorder = resumeError ? "#C0392B" : isDragging ? "#1A3A2F" : "rgba(26,58,47,0.35)";
  const dropBg = resumeError ? "rgba(192,57,43,0.06)" : isDragging ? "rgba(26,58,47,0.06)" : ONBOARDING_FIELD_BG;
  const canContinueWithResume = resumeUploaded;
  const canSaveLinkedInOnly = liInput.trim().length > 0 && !resumeUploaded;

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <OnboardingHeroIntro
        title="Hello. I'm Kimchi."
        body="Drop your resume and I'll read it — then I'll tell you what I see about your career."
      />

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
            marginTop: 0,
          }}
        >
          Your resume
        </p>
        {!resumeFilename ? (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={onFileClick}
            style={{
              border: `2px dashed ${dropBorder}`,
              borderRadius: 0,
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
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: ONBOARDING_TEXT }}>
                Drop your resume here
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 400, color: ONBOARDING_TEXT_SECONDARY }}>
                PDF or DOCX · click to browse
              </span>
            </div>
          </div>
        ) : !resumeUploaded ? (
          <ResumeReadingProgress filename={resumeFilename} />
        ) : (
          <div
            className="anim-fade-in"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              background: ONBOARDING_FIELD_BG,
              border: ONBOARDING_FIELD_BORDER,
              borderRadius: 0,
            }}
          >
            <CheckCircleFilled />
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A3A2F", flex: 1 }}>
              {resumeFilename}
            </span>
            <button
              onClick={onFileClick}
              style={{
                background: "none",
                border: "none",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                fontWeight: 500,
                color: ONBOARDING_TEXT_SECONDARY,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Change
            </button>
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
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#C0392B", marginTop: 12, marginBottom: 0, fontWeight: 500 }}>
            Upload failed — please try again or paste your LinkedIn below.
          </p>
        )}
      </div>

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.5s" }}>
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
          LinkedIn <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: "none", color: ONBOARDING_TEXT_SECONDARY }}>(optional)</span>
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            background: ONBOARDING_FIELD_BG,
            border: ONBOARDING_FIELD_BORDER,
            borderRadius: 0,
          }}
        >
          <LinkedInIcon style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 15,
              fontWeight: 500,
              color: ONBOARDING_TEXT_SECONDARY,
              flexShrink: 0,
              userSelect: "none",
            }}
          >
            linkedin.com/in/
          </span>
          <input
            type="text"
            placeholder="your-name"
            value={liInput}
            onChange={onLIChange}
            onKeyDown={onLIKey}
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              background: "transparent",
              fontFamily: "var(--font-ui)",
              fontSize: 16,
              fontWeight: 500,
              color: ONBOARDING_TEXT,
              caretColor: "#1A3A2F",
              outline: "none",
            }}
          />
        </div>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 400, color: ONBOARDING_TEXT_SECONDARY, marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>
          We&apos;ll save this on your profile. Kimchi&apos;s read comes from your resume, not LinkedIn.
        </p>
      </div>

      {(canContinueWithResume || canSaveLinkedInOnly) && (
        <OnboardingActions skipLabel="Skip for now" onSkip={onSkip}>
          {canContinueWithResume && (
            <button
              className="onboarding-cta"
              onClick={onContinue}
              style={{ ...PRIMARY_CTA, width: "100%" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              See what Kimchi read →
            </button>
          )}
          {canSaveLinkedInOnly && (
            <button
              type="button"
              className="onboarding-cta"
              onClick={onLinkedInOnly}
              style={{
                ...PRIMARY_CTA,
                width: "100%",
                marginTop: canContinueWithResume ? 10 : 0,
                background: ONBOARDING_FIELD_BG,
                color: ONBOARDING_TEXT,
                border: ONBOARDING_FIELD_BORDER,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(26,58,47,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ONBOARDING_FIELD_BG; }}
            >
              Save LinkedIn &amp; continue without resume
            </button>
          )}
        </OnboardingActions>
      )}

      {!canContinueWithResume && !canSaveLinkedInOnly && (
        <div className="anim-fade-up" style={ONBOARDING_CARD}>
          <button type="button" onClick={onSkip} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 0 }}>
            Skip for now
          </button>
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
          borderRadius: 0,
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
  if (fit === "Strong match") return "#1A3A2F";
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
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <OnboardingEyebrowIntro eyebrow="Kimchi's read" title="Here's what I see." />

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.35s", minHeight: loading ? 320 : undefined }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: ONBOARDING_LABEL_COLOR, letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 6, marginTop: 0 }}>
                Reading your resume...
              </p>
              {[180, 220, 140].map((w, i) => (
                <div key={i} style={{ height: 14, width: w, borderRadius: 0, background: "#F0EDE8", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
              <div style={{ height: 1, background: "#EEE9E2", margin: "10px 0" }} />
              {[160, 200, 140].map((w, i) => (
                <div key={i} style={{ height: 14, width: w, borderRadius: 0, background: "#F0EDE8", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.2 + 0.3}s` }} />
              ))}
            </div>
          )}

          {!loading && (error || !data) && (
            <>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: ONBOARDING_TEXT_SECONDARY, lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
                We couldn&apos;t generate your read right now — that happens sometimes. You can keep going and add a job; upload a resume anytime from Profile → Assets for the full read.
              </p>
              <button
                type="button"
                onClick={onSkip}
                style={{ ...PRIMARY_CTA, width: "100%" }}
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
                  fontWeight: 600,
                  color: ONBOARDING_LABEL_COLOR,
                  letterSpacing: "0.6px",
                  textTransform: "uppercase",
                  marginBottom: 16,
                  marginTop: 0,
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
                      padding: "8px 14px",
                      background: ONBOARDING_FIELD_BG,
                      border: ONBOARDING_FIELD_BORDER,
                      borderRadius: 0,
                      fontFamily: "var(--font-ui)",
                      fontSize: 13,
                      fontWeight: 500,
                      color: ONBOARDING_TEXT,
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* Target roles */}
              <div
                style={{
                  marginBottom: 24,
                  padding: "14px 16px",
                  background: ONBOARDING_FIELD_BG,
                  borderRadius: 0,
                  border: ONBOARDING_FIELD_BORDER,
                  borderLeft: "3px solid #1A3A2F",
                }}
              >
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
              <div style={{ padding: "14px 16px", background: ONBOARDING_FIELD_BG, borderRadius: 0, border: ONBOARDING_FIELD_BORDER }}>
                <p
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: ONBOARDING_LABEL_COLOR,
                    letterSpacing: "0.6px",
                    textTransform: "uppercase",
                    marginBottom: 9,
                    marginTop: 0,
                  }}
                >
                  One honest note
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    fontWeight: 400,
                    color: ONBOARDING_TEXT_SECONDARY,
                    lineHeight: 1.6,
                    textWrap: "pretty",
                    margin: 0,
                  }}
                >
                  {data.honestNote}
                </p>
              </div>
            </>
          )}
      </div>

      {!loading && data && !error && (
        <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.55s" }}>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 21,
              fontStyle: "italic",
              fontWeight: 400,
              color: ONBOARDING_TEXT_SECONDARY,
              lineHeight: 1.55,
              marginBottom: 20,
              marginTop: 0,
            }}
          >
            Does this feel like you?
          </p>
          <div className="onboarding-readback-actions">
            <button
              className="onboarding-cta"
              onClick={() => onConfirm(data)}
              style={{ ...PRIMARY_CTA, flex: 1 }}
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
                background: ONBOARDING_FIELD_BG,
                color: ONBOARDING_TEXT,
                border: ONBOARDING_FIELD_BORDER,
                borderRadius: 0,
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.15s",
                flex: 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(26,58,47,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ONBOARDING_FIELD_BG; }}
            >
              Re-upload resume
            </button>
          </div>
          <button type="button" onClick={onSkip} style={ONBOARDING_SKIP_LINK}>
            Skip for now
          </button>
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
              borderRadius: 0,
              boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 3px 10px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 0,
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
              borderRadius: 0,
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
   Screen 2 — Target Roles
   ────────────────────────────────────────────────────────────── */
interface TargetRolesProps {
  selectedTitles: string[];
  suggestedTitles?: string[];
  onAddTitle: (title: string) => void;
  onRemoveTitle: (title: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

function TargetRoleChip({
  title,
  onRemove,
}: {
  title: string;
  onRemove?: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "rgba(26,58,47,0.12)",
        border: "1.5px solid #1A3A2F",
        borderRadius: 0,
        fontFamily: "var(--font-ui)",
        fontSize: 14,
        fontWeight: 600,
        color: "#1A3A2F",
      }}
    >
      {title}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${title}`}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
            fontSize: 16,
            lineHeight: 1,
            color: "#1A3A2F",
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

function TargetRoleAutocomplete({
  selectedTitles,
  suggestedTitles,
  onAddTitle,
  onRemoveTitle,
  onDropdownOpenChange,
}: {
  selectedTitles: string[];
  suggestedTitles: string[];
  onAddTitle: (title: string) => void;
  onRemoveTitle: (title: string) => void;
  onDropdownOpenChange?: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const atMax = selectedTitles.length >= 3;
  const readbackSuggestions = suggestedTitles.filter((t) => !selectedTitles.includes(t));

  const dropdownOptions = useMemo(() => {
    if (atMax) return [];
    return mergeRoleSuggestions(query, readbackSuggestions, 10).filter(
      (t) => !selectedTitles.includes(t)
    );
  }, [query, readbackSuggestions, selectedTitles, atMax]);

  useEffect(() => {
    setHighlight(0);
  }, [query, dropdownOptions.length]);

  useEffect(() => {
    onDropdownOpenChange?.(open && dropdownOptions.length > 0);
  }, [open, dropdownOptions.length, onDropdownOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const tryAdd = (raw: string) => {
    const normalized = normalizeCustomRoleTitle(raw);
    if (!normalized || selectedTitles.includes(normalized) || selectedTitles.length >= 3) return false;
    onAddTitle(normalized);
    setQuery("");
    setOpen(false);
    return true;
  };

  const pickOption = (title: string) => {
    tryAdd(title);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef}>
      {selectedTitles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {selectedTitles.map((title) => (
            <TargetRoleChip key={title} title={title} onRemove={() => onRemoveTitle(title)} />
          ))}
        </div>
      )}

      {readbackSuggestions.length > 0 && !atMax && (
        <div style={{ marginBottom: 14 }}>
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 600,
              color: ONBOARDING_TEXT_SECONDARY,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
              marginBottom: 8,
              marginTop: 0,
            }}
          >
            Suggested from your resume
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {readbackSuggestions.slice(0, 4).map((title) => (
              <button
                key={title}
                type="button"
                className="onboarding-chip"
                onClick={() => pickOption(title)}
                style={{
                  padding: "8px 14px",
                  background: ONBOARDING_FIELD_BG,
                  border: ONBOARDING_FIELD_BORDER,
                  borderRadius: 0,
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: ONBOARDING_TEXT,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <label
          htmlFor="target-role-input"
          style={{
            display: "block",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 600,
            color: ONBOARDING_LABEL_COLOR,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          {atMax ? "Target roles · max 3 selected" : `Target role · ${selectedTitles.length}/3`}
        </label>
        <input
          id="target-role-input"
          ref={inputRef}
          type="text"
          value={query}
          disabled={atMax}
          placeholder={atMax ? "Remove one to add another" : "Start typing a role title…"}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && dropdownOptions.length > 0}
          aria-controls="target-role-listbox"
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((i) => Math.min(i + 1, Math.max(dropdownOptions.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && dropdownOptions[highlight]) pickOption(dropdownOptions[highlight]);
              else tryAdd(query);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          style={{
            width: "100%",
            minHeight: 48,
            padding: "12px 14px",
            border: ONBOARDING_FIELD_BORDER,
            borderRadius: 0,
            background: atMax ? "rgba(247,245,242,0.6)" : ONBOARDING_FIELD_BG,
            fontFamily: "var(--font-ui)",
            fontSize: 16,
            fontWeight: 500,
            color: ONBOARDING_TEXT,
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        {open && !atMax && dropdownOptions.length > 0 && (
          <ul
            id="target-role-listbox"
            role="listbox"
            style={{
              position: "absolute",
              zIndex: 20,
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              margin: 0,
              padding: 6,
              listStyle: "none",
              background: "#FFFFFF",
              border: "1px solid rgba(26,58,47,0.16)",
              borderRadius: 0,
              boxShadow: "0 8px 24px rgba(26,58,47,0.12)",
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {dropdownOptions.map((title, index) => (
              <li key={title} role="option" aria-selected={index === highlight}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickOption(title)}
                  onMouseEnter={() => setHighlight(index)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderRadius: 0,
                    background: index === highlight ? "rgba(26,58,47,0.08)" : "transparent",
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    fontWeight: 500,
                    color: ONBOARDING_TEXT,
                    cursor: "pointer",
                  }}
                >
                  {title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!atMax && query.trim() && dropdownOptions.length === 0 && (
        <button
          type="button"
          onClick={() => tryAdd(query)}
          style={{
            marginTop: 10,
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 500,
            color: "#1A3A2F",
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Use &ldquo;{normalizeCustomRoleTitle(query) ?? query.trim()}&rdquo;
        </button>
      )}

      {!query && !atMax && (
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          {TARGET_ROLE_SUGGESTIONS.length}+ common titles — type to filter, Enter to add.
        </p>
      )}
    </div>
  );
}

export function ScreenTargetRoles({
  selectedTitles,
  suggestedTitles = [],
  onAddTitle,
  onRemoveTitle,
  onContinue,
  onSkip,
}: TargetRolesProps) {
  const canContinue = selectedTitles.length > 0;
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <AboutYouIntro
        title="What roles are you targeting?"
        body="Search and pick up to 3 titles. We'll use these for job search, fit scoring, and your pipeline."
      />

      <div
        className="anim-fade-up"
        style={{
          ...ONBOARDING_CARD,
          animationDelay: "0.2s",
          position: "relative",
          zIndex: dropdownOpen ? 30 : undefined,
        }}
      >
        <TargetRoleAutocomplete
          selectedTitles={selectedTitles}
          suggestedTitles={suggestedTitles}
          onAddTitle={onAddTitle}
          onRemoveTitle={onRemoveTitle}
          onDropdownOpenChange={setDropdownOpen}
        />

        {!canContinue && (
          <button type="button" onClick={onSkip} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 16 }}>
            Skip for now
          </button>
        )}
      </div>

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
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 3 — Target companies (watchlist)
   ────────────────────────────────────────────────────────────── */
export type OnboardingCompanyPick = {
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  type: string | null;
};

type CompanySuggestion = {
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  type: string | null;
};

interface TargetCompaniesProps {
  selectedCompanies: OnboardingCompanyPick[];
  targetRoles: string[];
  onAddCompany: (company: OnboardingCompanyPick) => void;
  onRemoveCompany: (catalogSlug: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}

function suggestionToPick(item: CompanySuggestion): OnboardingCompanyPick {
  return {
    catalogSlug: item.catalogSlug,
    name: item.name,
    website: item.website,
    careersUrl: item.careersUrl,
    type: item.type,
  };
}

function catalogToPick(c: (typeof ONBOARDING_COMPANY_PICKS)[number]): OnboardingCompanyPick {
  return {
    catalogSlug: c.slug,
    name: c.name,
    website: c.website ?? null,
    careersUrl: c.careersUrl ?? null,
    type: c.type ?? null,
  };
}

function TargetCompanyChip({
  company,
  onRemove,
}: {
  company: OnboardingCompanyPick;
  onRemove: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px 6px 6px",
        background: ONBOARDING_FIELD_BG,
        border: ONBOARDING_FIELD_BORDER,
        borderRadius: 8,
        fontFamily: "var(--font-ui)",
        fontSize: 13,
        fontWeight: 500,
        color: ONBOARDING_TEXT,
      }}
    >
      <CompanyLogo
        name={company.name}
        website={company.website}
        careersUrl={company.careersUrl}
        size={24}
        borderRadius={6}
      />
      <span>{company.name}</span>
      <button
        type="button"
        aria-label={`Remove ${company.name}`}
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          marginLeft: 2,
          fontSize: 16,
          lineHeight: 1,
          color: ONBOARDING_TEXT_SECONDARY,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </span>
  );
}

function TargetCompanyAutocomplete({
  selectedCompanies,
  onAddCompany,
  onRemoveCompany,
  onDropdownOpenChange,
}: {
  selectedCompanies: OnboardingCompanyPick[];
  onAddCompany: (company: OnboardingCompanyPick) => void;
  onRemoveCompany: (catalogSlug: string) => void;
  onDropdownOpenChange?: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const max = ONBOARDING_MAX_TARGET_COMPANIES;
  const atMax = selectedCompanies.length >= max;
  const selectedSlugs = new Set(selectedCompanies.map((c) => c.catalogSlug));
  const quickPicks = ONBOARDING_COMPANY_PICKS.filter((c) => !selectedSlugs.has(c.slug));

  const dropdownOptions = useMemo(
    () => suggestions.filter((s) => !selectedSlugs.has(s.catalogSlug)),
    [suggestions, selectedSlugs]
  );

  useEffect(() => {
    setHighlight(0);
  }, [query, dropdownOptions.length]);

  useEffect(() => {
    onDropdownOpenChange?.(open && dropdownOptions.length > 0);
  }, [open, dropdownOptions.length, onDropdownOpenChange]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/suggest?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data: CompanySuggestion[] = await res.json();
          setSuggestions(data);
          setOpen(data.length > 0);
        }
      } catch {
        /* ignore */
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const pick = (item: CompanySuggestion | OnboardingCompanyPick) => {
    if (atMax || selectedSlugs.has(item.catalogSlug)) return;
    onAddCompany(suggestionToPick(item));
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef}>
      {selectedCompanies.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {selectedCompanies.map((company) => (
            <TargetCompanyChip
              key={company.catalogSlug}
              company={company}
              onRemove={() => onRemoveCompany(company.catalogSlug)}
            />
          ))}
        </div>
      )}

      {quickPicks.length > 0 && !atMax && (
        <div style={{ marginBottom: 14 }}>
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 600,
              color: ONBOARDING_TEXT_SECONDARY,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
              marginBottom: 8,
              marginTop: 0,
            }}
          >
            Popular picks
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {quickPicks.slice(0, 10).map((c) => (
              <button
                key={c.slug}
                type="button"
                className="onboarding-chip"
                onClick={() => pick(catalogToPick(c))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px 8px 8px",
                  background: ONBOARDING_FIELD_BG,
                  border: ONBOARDING_FIELD_BORDER,
                  borderRadius: 8,
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: ONBOARDING_TEXT,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <CompanyLogo name={c.name} website={c.website} careersUrl={c.careersUrl} size={22} borderRadius={5} />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        <label
          htmlFor="target-company-input"
          style={{
            display: "block",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 600,
            color: ONBOARDING_LABEL_COLOR,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          {atMax
            ? `Dream companies · max ${max} selected`
            : `Dream company · ${selectedCompanies.length}/${max}`}
        </label>
        <input
          id="target-company-input"
          ref={inputRef}
          type="text"
          value={query}
          disabled={atMax}
          placeholder={atMax ? "Remove one to add another" : "Search companies — e.g. Stripe, HubSpot…"}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && dropdownOptions.length > 0}
          aria-controls="target-company-listbox"
          aria-autocomplete="list"
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((i) => Math.min(i + 1, Math.max(dropdownOptions.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && dropdownOptions[highlight]) pick(dropdownOptions[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          style={{
            width: "100%",
            minHeight: 48,
            padding: "12px 14px",
            border: ONBOARDING_FIELD_BORDER,
            borderRadius: 8,
            background: atMax ? "rgba(247,245,242,0.6)" : ONBOARDING_FIELD_BG,
            fontFamily: "var(--font-ui)",
            fontSize: 16,
            fontWeight: 500,
            color: ONBOARDING_TEXT,
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        {open && !atMax && dropdownOptions.length > 0 && (
          <ul
            id="target-company-listbox"
            role="listbox"
            style={{
              position: "absolute",
              zIndex: 20,
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              margin: 0,
              padding: 6,
              listStyle: "none",
              background: "#FFFFFF",
              border: "1px solid rgba(26,58,47,0.16)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(26,58,47,0.12)",
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {dropdownOptions.map((item, index) => (
              <li key={item.catalogSlug} role="option" aria-selected={index === highlight}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                  onMouseEnter={() => setHighlight(index)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderRadius: 6,
                    background: index === highlight ? "rgba(26,58,47,0.08)" : "transparent",
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    fontWeight: 500,
                    color: ONBOARDING_TEXT,
                    cursor: "pointer",
                  }}
                >
                  <CompanyLogo
                    name={item.name}
                    website={item.website}
                    careersUrl={item.careersUrl}
                    size={28}
                    borderRadius={6}
                  />
                  <span>
                    {item.name}
                    {item.type ? (
                      <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: ONBOARDING_TEXT_SECONDARY }}>
                        {item.type}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!query && !atMax && (
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          Pick up to {max}. We&apos;ll scan each for roles that match your target titles.
        </p>
      )}
    </div>
  );
}

export function ScreenTargetCompanies({
  selectedCompanies,
  targetRoles,
  onAddCompany,
  onRemoveCompany,
  onContinue,
  onSkip,
}: TargetCompaniesProps) {
  const canContinue = selectedCompanies.length > 0;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const rolesPreview = targetRoles.slice(0, 2).join(", ");

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <AboutYouIntro
        title="Which companies do you want to go after?"
        body={`Add up to ${ONBOARDING_MAX_TARGET_COMPANIES} dream employers. We'll watch for open roles that fit your target titles and show them on your Companies watchlist.`}
      />

      {targetRoles.length > 0 && (
        <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.15s", padding: "16px 18px" }}>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: ONBOARDING_TEXT_SECONDARY, lineHeight: 1.55, margin: 0 }}>
            When we find a match for{" "}
            <span style={{ fontWeight: 600, color: ONBOARDING_TEXT }}>
              {rolesPreview}
              {targetRoles.length > 2 ? ` +${targetRoles.length - 2} more` : ""}
            </span>
            , you&apos;ll see it here — no need to refresh job boards every day.
          </p>
        </div>
      )}

      <div
        className="anim-fade-up"
        style={{
          ...ONBOARDING_CARD,
          animationDelay: "0.2s",
          position: "relative",
          zIndex: dropdownOpen ? 30 : undefined,
        }}
      >
        <TargetCompanyAutocomplete
          selectedCompanies={selectedCompanies}
          onAddCompany={onAddCompany}
          onRemoveCompany={onRemoveCompany}
          onDropdownOpenChange={setDropdownOpen}
        />

        {!canContinue && (
          <button type="button" onClick={onSkip} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 16 }}>
            Skip for now
          </button>
        )}
      </div>

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
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Screen 4–5 — About You (split for scroll)
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
        borderRadius: 0,
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
                  borderRadius: 0,
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
    borderRadius: 0,
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
    score >= 8 ? "#1A3A2F" : score >= 6 ? "#C4A86A" : score >= 4 ? "#C4574A" : "#9B3A2A";
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
  onFinish: () => void;
  onFinishWithJob: () => void;
  onSkip: () => void;
  loading: boolean;
  loadingPhase?: "parse" | "match" | null;
  error: string | null;
  matchError: string | null;
  analysis: TransitionJobAnalysis | null;
  match: TransitionJobMatch | null;
}

function matchArticle(label: string): "a" | "an" {
  return /^[aeiou]/i.test(label.trim()) ? "an" : "a";
}

function JobBoardShortcutButton({ id, label, url }: { id: JobBoardId; label: string; url: string }) {
  const Icon = id === "linkedin" ? LinkedInIcon : id === "indeed" ? IndeedIcon : GoogleIcon;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Search ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: ONBOARDING_FIELD_BG,
        border: ONBOARDING_FIELD_BORDER,
        borderRadius: 0,
        fontFamily: "var(--font-ui)",
        fontSize: 14,
        fontWeight: 600,
        color: ONBOARDING_TEXT,
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      <Icon style={{ flexShrink: 0 }} />
      {label}
    </a>
  );
}

export function ScreenTransition({
  targetRoles = [],
  jobUrl,
  onJobUrlChange,
  onAnalyze,
  onFinish,
  onFinishWithJob,
  onSkip,
  loading,
  loadingPhase = null,
  error,
  matchError,
  analysis,
  match,
}: TransitionProps) {
  const canAnalyze = jobUrl.trim().length > 0 && !loading;
  const primarySearchRole = targetRoles[0] ?? "";
  const jobBoardLinks = buildJobBoardLinks(primarySearchRole);
  const scoreColor =
    match && match.score >= 8
      ? "#1A3A2F"
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
          Paste one job listing URL. Kimchi reads the posting and scores how well your resume fits.
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
                  borderRadius: 0,
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

        {jobBoardLinks.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: ONBOARDING_TEXT_SECONDARY, lineHeight: 1.55, marginTop: 0, marginBottom: 10 }}>
              Browse openings for{" "}
              <span style={{ fontWeight: 600, color: ONBOARDING_TEXT }}>{primarySearchRole}</span>
              , then paste one listing URL below:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {jobBoardLinks.map((link) => (
                <JobBoardShortcutButton key={link.id} id={link.id} label={link.label} url={link.url} />
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="url"
            autoFocus
            placeholder="Paste a job listing URL (not a search page)…"
            value={jobUrl}
            onChange={(e) => onJobUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (analysis) onFinishWithJob();
                else if (canAnalyze) onAnalyze();
              }
            }}
            style={{
              width: "100%",
              minHeight: 48,
              padding: "12px 14px",
              border: ONBOARDING_FIELD_BORDER,
              borderRadius: 0,
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
              {loading ? "Reading listing…" : "Read listing & score fit →"}
            </button>
          )}
          {!analysis && !loading && (
            <button type="button" onClick={onSkip} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 4 }}>
              Skip — finish without a job →
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
              borderRadius: 0,
              border: ONBOARDING_FIELD_BORDER,
            }}
          >
            {(!analysis.company || !analysis.role) && (
              <p
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  color: "#9A6B2E",
                  lineHeight: 1.55,
                  marginTop: 0,
                  marginBottom: 14,
                  padding: "10px 12px",
                  background: "rgba(196,168,106,0.12)",
                  borderRadius: 0,
                }}
              >
                We couldn&apos;t pull the company or job title from that link. Open one job from the boards above and paste its direct listing URL (e.g. linkedin.com/jobs/view/…).
              </p>
            )}

            {(analysis.company || analysis.role) && (
              <>
                {analysis.company && (
                  <p
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#1A1A1A",
                      marginBottom: 4,
                      marginTop: 0,
                    }}
                  >
                    {analysis.company}
                  </p>
                )}
                {analysis.role && (
                  <p
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 14,
                      fontWeight: 400,
                      color: "#52493F",
                      marginBottom: 10,
                      marginTop: 0,
                    }}
                  >
                    {analysis.role}
                  </p>
                )}
              </>
            )}
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

            {match && analysis.role && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "14px 16px",
                  marginBottom: 14,
                  background: "#FAF7F2",
                  borderRadius: 0,
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
                    You&apos;re {matchArticle(match.scoreLabel)} {match.scoreLabel} match for{" "}
                    <span style={{ color: scoreColor }}>{analysis.role}</span>
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <ScoreExplainerPopover variant="job-match" align="right" />
                  <TransitionScoreGauge score={match.score} />
                </div>
              </div>
            )}

            {match && !analysis.role && (
              <p
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  color: ONBOARDING_TEXT_SECONDARY,
                  lineHeight: 1.5,
                  marginBottom: 14,
                }}
              >
                We found listing text but need a direct job URL before we can show a fit score for a specific role.
              </p>
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

            {analysis && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {analysis.role && (
                  <button
                    type="button"
                    className="onboarding-cta"
                    onClick={onFinishWithJob}
                    style={PRIMARY_CTA}
                  >
                    {match ? "Save job & open my resume →" : "Save job & continue →"}
                  </button>
                )}
                {match && analysis.role && (
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, lineHeight: 1.5, margin: 0, textAlign: "center" }}>
                    We&apos;ll add this to Pipeline and open your resume with this match score.
                  </p>
                )}
                <button type="button" onClick={onFinish} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 4 }}>
                  {analysis.role ? "Continue without saving this job →" : "Finish setup without this job →"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export type SetupStepStatus = "pending" | "active" | "done" | "skipped";

export interface SetupStep {
  id: string;
  label: string;
  status: SetupStepStatus;
}

export function ScreenSetup({ steps }: { steps: SetupStep[] }) {
  return (
    <div className="anim-fade-up onboarding-screen-gap" style={ONBOARDING_CARD}>
      <h2 style={{ ...DISPLAY_H2, lineHeight: 1.04, marginBottom: 12, marginTop: 0 }}>
        Setting things up…
      </h2>
      <p style={{ ...ONBOARDING_BODY, margin: "0 0 24px", color: ONBOARDING_TEXT_SECONDARY, fontSize: "clamp(0.9375rem, 2.5vw, 1rem)" }}>
        This usually takes under a minute. Stay on this page while Kimchi gets your desk ready.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((step) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSkipped = step.status === "skipped";
          return (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 0,
                border: `1.5px solid ${isDone ? "#1A3A2F" : isActive ? "rgba(26,58,47,0.35)" : "rgba(26,58,47,0.12)"}`,
                background: isDone ? "rgba(26,58,47,0.06)" : ONBOARDING_FIELD_BG,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isDone ? "#1A3A2F" : "rgba(26,58,47,0.08)",
                  color: isDone ? "#E8D5A3" : ONBOARDING_TEXT_SECONDARY,
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {isDone ? "✓" : isSkipped ? "—" : isActive ? "…" : ""}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  fontWeight: isActive || isDone ? 600 : 500,
                  color: isSkipped ? ONBOARDING_TEXT_SECONDARY : ONBOARDING_TEXT,
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
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
          borderRadius: 0,
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
