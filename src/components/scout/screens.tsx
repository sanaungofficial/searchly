"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { JobBoardId } from "@/lib/job-board-search";
import { buildJobBoardLinks } from "@/lib/job-board-search";
import {
  mergeRoleSuggestions,
  normalizeCustomRoleTitle,
  TARGET_ROLE_SUGGESTIONS,
} from "@/lib/target-roles";
import { ONBOARDING_MAX_TARGET_COMPANIES } from "@/lib/company-catalog";
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
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { LocationAutocompleteInput } from "./location-autocomplete-input";
import {
  ONBOARDING_RELOCATION_OPTIONS,
  ONBOARDING_VISA_OPTIONS,
  ONBOARDING_WORK_ARRANGEMENTS,
  type RelocationId,
  type VisaNeedId,
  type WorkArrangementId,
} from "@/lib/onboarding-preferences";

/* ──────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────── */
export type Screen = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

const ONBOARDING_STEP_COUNT = 12;

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
  borderRadius: "var(--scout-radius)",
  padding: ONBOARDING_SECTION_PAD,
  border: "var(--scout-border)",
  boxShadow: "var(--scout-shadow-card)",
};

const ONBOARDING_FIELD_BG = "var(--scout-inset)";
const ONBOARDING_FIELD_BORDER = "var(--scout-border)";
const ONBOARDING_TEXT = "#1A1A1A";
const ONBOARDING_TEXT_SECONDARY = "#52493F";
const ONBOARDING_LABEL_COLOR = "#2A2218";

const PRIMARY_CTA: React.CSSProperties = {
  padding: "14px 30px",
  background: "var(--scout-cta)",
  color: "var(--scout-cta-foreground)",
  border: "var(--scout-border)",
  borderRadius: "var(--scout-radius)",
  boxShadow: "var(--scout-shadow-bruddle)",
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
  const logoTitle = onScoutClick ? "Go to workspace" : "Almost done — finish setup first";
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
              width: ONBOARDING_STEP_COUNT > 8 ? 22 : 30,
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
  resumeUploading?: boolean;
  resumeError?: boolean;
  isDragging: boolean;
  liInput: string;
  linkedinImportAvailable?: boolean | null;
  linkedinImporting?: boolean;
  onLIChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLIKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onContinue: () => void;
  onLinkedInOnly: () => void;
  onStartFromScratch: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBack?: () => void;
}

function ResumeReadingProgress({ filename }: { filename: string }) {
  return (
    <div className="anim-fade-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 14,
          fontWeight: 600,
          color: ONBOARDING_TEXT,
          margin: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {filename}
      </p>
      <KimchiProcessLoader preset="resumeUpload" variant="inline" />
    </div>
  );
}

type SetupPath = "resume" | "linkedin" | "scratch";

function SetupPathCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...ONBOARDING_CARD,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        border: selected ? "2px solid #1A3A2F" : ONBOARDING_FIELD_BORDER,
        background: selected ? "rgba(26,58,47,0.06)" : ONBOARDING_FIELD_BG,
        padding: "16px 18px",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: ONBOARDING_TEXT, margin: "0 0 6px" }}>
        {title}
      </p>
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 400, color: ONBOARDING_TEXT_SECONDARY, margin: 0, lineHeight: 1.55 }}>
        {description}
      </p>
    </button>
  );
}

export function ScreenWelcome({
  resumeFilename,
  resumeUploaded,
  resumeUploading = false,
  resumeError,
  isDragging,
  liInput,
  linkedinImportAvailable = null,
  linkedinImporting = false,
  onLIChange,
  onLIKey,
  onContinue,
  onLinkedInOnly,
  onStartFromScratch,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileClick,
  onFileChange,
  onBack,
}: WelcomeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<SetupPath | null>(null);
  const dropBorder = resumeError ? "#C0392B" : isDragging ? "#1A3A2F" : "rgba(26,58,47,0.35)";
  const dropBg = resumeError ? "rgba(192,57,43,0.06)" : isDragging ? "rgba(26,58,47,0.06)" : ONBOARDING_FIELD_BG;
  const canContinueWithResume = !!(resumeFilename && !resumeError);
  const canSaveLinkedInOnly = liInput.trim().length > 0 && !resumeFilename;
  const linkedinScrapeReady = linkedinImportAvailable === true;

  const heroBody =
    path === "resume"
      ? "Upload a PDF or Word file — we'll read it while you answer a few quick questions."
      : path === "linkedin"
        ? linkedinScrapeReady
          ? "Paste your LinkedIn link. If it's light on details, we'll help you fill in the rest."
          : "Paste your LinkedIn link — we'll save it to your profile. Automatic import is coming soon on this environment."
        : path === "scratch"
          ? "No resume? No problem. We'll ask a few questions and help you build your profile step by step."
          : "Pick how you'd like to start. You can always add or change things later.";

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <OnboardingHeroIntro title="Let's build your profile." body={heroBody} />

      {!path && (
        <div className="anim-fade-up flex flex-col gap-3" style={{ animationDelay: "0.25s" }}>
          <SetupPathCard
            title="Upload my resume"
            description="Best if you already have a resume file — PDF or Word."
            selected={false}
            onClick={() => setPath("resume")}
          />
          <SetupPathCard
            title="Use my LinkedIn"
            description={
              linkedinImportAvailable === false
                ? "Save your profile link now — automatic import is coming soon here."
                : "We'll pull what we can from your public LinkedIn profile."
            }
            selected={false}
            onClick={() => setPath("linkedin")}
          />
          <SetupPathCard
            title="Start from scratch"
            description="We'll walk you through it — type your answers or talk to Kimchi on the next step."
            selected={false}
            onClick={onStartFromScratch}
          />
        </div>
      )}

      {path && (
        <button
          type="button"
          onClick={() => setPath(null)}
          style={{
            ...ONBOARDING_SKIP_LINK,
            alignSelf: "flex-start",
            marginTop: 0,
          }}
        >
          ← Choose a different option
        </button>
      )}

      {path === "resume" && (
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
                borderRadius: "var(--scout-radius)",
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
                  PDF or DOCX — click to browse
                </span>
              </div>
            </div>
          ) : !resumeUploaded ? (
            <>
              <ResumeReadingProgress filename={resumeFilename} />
              {(resumeUploading || !resumeUploaded) && (
                <p
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1A3A2F",
                    marginTop: 14,
                    marginBottom: 0,
                    lineHeight: 1.55,
                  }}
                >
                  You can hit Continue below — we&apos;ll keep reading in the background.
                </p>
              )}
            </>
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
                borderRadius: "var(--scout-radius)",
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
              That upload didn&apos;t work. Try again, or pick a different option above.
            </p>
          )}
        </div>
      )}

      {path === "linkedin" && (
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
            Your LinkedIn
          </p>
          {linkedinImportAvailable === false && (
            <div
              style={{
                marginBottom: 14,
                padding: "12px 14px",
                borderRadius: "var(--scout-radius)",
                border: "1px solid rgba(26,58,47,0.16)",
                background: "rgba(26,58,47,0.05)",
              }}
            >
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "#1A3A2F", margin: "0 0 4px" }}>
                LinkedIn import — coming soon
              </p>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 400, color: ONBOARDING_TEXT_SECONDARY, margin: 0, lineHeight: 1.55 }}>
                We&apos;ll save your URL and you can keep going. Import from Profile later when this is enabled.
              </p>
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              background: ONBOARDING_FIELD_BG,
              border: ONBOARDING_FIELD_BORDER,
              borderRadius: "var(--scout-radius)",
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
            {linkedinScrapeReady
              ? "If your profile is pretty empty, no worries — we'll help you add the rest as you go."
              : "You can still finish onboarding and build your profile from scratch or upload a resume later."}
          </p>
          {linkedinImporting && (
            <div style={{ marginTop: 16 }}>
              <KimchiProcessLoader preset="linkedInImport" variant="inline" />
            </div>
          )}
        </div>
      )}

      {path === "scratch" && (
        <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.35s" }}>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: ONBOARDING_TEXT, margin: "0 0 10px", lineHeight: 1.5 }}>
            We&apos;ll help you build it
          </p>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 400, color: ONBOARDING_TEXT_SECONDARY, margin: 0, lineHeight: 1.6 }}>
            Next up: a few quick questions about your goals and experience. Answer by typing — or talk it through when voice is ready. You can upload a resume or LinkedIn anytime from Profile.
          </p>
        </div>
      )}

      {path === "resume" && canContinueWithResume && (
        <OnboardingActions skipLabel="Choose another option" onSkip={() => setPath(null)}>
          <button
            className="onboarding-cta"
            onClick={onContinue}
            style={{ ...PRIMARY_CTA, width: "100%" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Continue →
          </button>
        </OnboardingActions>
      )}

      {path === "linkedin" && canSaveLinkedInOnly && (
        <OnboardingActions skipLabel="Choose another option" onSkip={() => setPath(null)}>
          <button
            type="button"
            className="onboarding-cta"
            onClick={onLinkedInOnly}
            disabled={linkedinImporting}
            style={{
              ...PRIMARY_CTA,
              width: "100%",
              opacity: linkedinImporting ? 0.6 : 1,
              cursor: linkedinImporting ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!linkedinImporting) e.currentTarget.style.opacity = "0.86";
            }}
            onMouseLeave={(e) => {
              if (!linkedinImporting) e.currentTarget.style.opacity = "1";
            }}
          >
            {linkedinImporting
              ? "Importing LinkedIn…"
              : linkedinScrapeReady
                ? "Continue with LinkedIn →"
                : "Save & continue →"}
          </button>
        </OnboardingActions>
      )}

      {path === "scratch" && (
        <OnboardingActions skipLabel="Choose another option" onSkip={() => setPath(null)}>
          <button
            type="button"
            className="onboarding-cta"
            onClick={onStartFromScratch}
            style={{ ...PRIMARY_CTA, width: "100%" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Let&apos;s build my profile →
          </button>
        </OnboardingActions>
      )}

      {onBack && (
        <button type="button" onClick={onBack} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 4 }}>
          ← Back
        </button>
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
          borderRadius: "var(--scout-radius)",
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
        I&apos;ll use it to fill in gaps — especially what might not be on your resume.
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
        <div className="anim-fade-in">
          <KimchiProcessLoader preset="onboardingBackground" variant="inline" />
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
  data: ReadBackData | null;
  status: ReadBackStatus;
  onConfirm: (data: ReadBackData | null) => void;
  onRefine: () => void;
  onSkip: () => void;
  /** When provided, replaces the "Try a different resume" refine button with a back button */
  onBack?: () => void;
  /** Override the confirm button label */
  confirmLabel?: string;
  /** Override the hero title */
  title?: string;
  /** Override the hero body */
  body?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isReadBackPayload(value: unknown): value is ReadBackData {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  return typeof d.picture === "string" && Array.isArray(d.strengths) && Array.isArray(d.targetRoles);
}

export async function fetchReadbackWithRetry(maxAttempts = 20, delayMs = 3000): Promise<ReadBackData | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch("/api/ai/readback", { cache: "no-store" });
      const data = await res.json();
      if (isReadBackPayload(data)) return data;

      const retryable =
        res.status === 404 ||
        res.status === 503 ||
        res.status >= 500 ||
        data?.retryable === true;

      if (retryable && attempt < maxAttempts - 1) {
        await sleep(delayMs);
        continue;
      }
      return null;
    } catch {
      if (attempt < maxAttempts - 1) {
        await sleep(delayMs);
        continue;
      }
      return null;
    }
  }
  return null;
}

export type ReadBackStatus = "idle" | "loading" | "ready" | "pending" | "skipped";

export function OnboardingProcessingBanner({
  resumeUploading,
  readbackLoading,
}: {
  resumeUploading: boolean;
  readbackLoading: boolean;
}) {
  if (!resumeUploading && !readbackLoading) return null;

  const parts: string[] = [];
  if (resumeUploading) parts.push("reading your resume");
  if (readbackLoading) parts.push("writing your read");

  return (
    <div
      className="anim-fade-in"
      role="status"
      aria-live="polite"
      style={{
        ...ONBOARDING_CARD,
        padding: "14px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: "rgba(26,58,47,0.05)",
        border: "1px solid rgba(26,58,47,0.14)",
        marginBottom: 4,
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">
        📄
      </span>
      <p
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          fontWeight: 500,
          color: ONBOARDING_TEXT,
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        Still working in the background
        {parts.length ? ` (${parts.join(" + ")})` : ""}. Keep going with the questions below.
      </p>
    </div>
  );
}

function fitColor(fit: string): string {
  if (fit === "Strong match") return "#1A3A2F";
  if (fit === "Good fit") return "#A89462";
  return "#8A7A6A";
}

export function ScreenReadBack({ data, status, onConfirm, onRefine, onSkip, onBack, confirmLabel, title, body }: ReadBackProps) {
  const loading = status === "loading";
  const pending = status === "pending";
  const skipped = status === "skipped";

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <OnboardingEyebrowIntro
        eyebrow="Your read"
        title={title ?? "Here's what stood out."}
        body={body ?? "Based on what you shared — does this sound right?"}
      />

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.35s", minHeight: loading || pending ? 280 : undefined }}>
          {loading && <KimchiProcessLoader preset="onboardingReadback" variant="inline" />}

          {!loading && pending && !data && (
            <>
              <KimchiProcessLoader
                preset="onboardingReadback"
                variant="inline"
                hint="Your resume is saved. We'll finish your read on your profile — keep going for now."
              />
              <button
                type="button"
                onClick={onSkip}
                style={{ ...PRIMARY_CTA, width: "100%", marginTop: 16 }}
              >
                Continue →
              </button>
              {onBack && (
                <button type="button" onClick={onBack} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 12 }}>
                  ← Back
                </button>
              )}
            </>
          )}

          {!loading && skipped && !data && (
            <>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: ONBOARDING_TEXT_SECONDARY, lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
                Upload a resume anytime from Profile → Resumes for a full read. For now, pick your target roles.
              </p>
              <button
                type="button"
                onClick={onSkip}
                style={{ ...PRIMARY_CTA, width: "100%" }}
              >
                Continue →
              </button>
              {onBack && (
                <button type="button" onClick={onBack} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 12 }}>
                  ← Back
                </button>
              )}
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
                The short version
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
                  borderBottom: "1px solid rgba(17,17,17,0.14)",
                }}
              >
                {data.strengths.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "8px 14px",
                      background: ONBOARDING_FIELD_BG,
                      border: ONBOARDING_FIELD_BORDER,
                      borderRadius: "var(--scout-radius)",
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
                  borderRadius: "var(--scout-radius)",
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
                  Roles that fit
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
              <div style={{ padding: "14px 16px", background: ONBOARDING_FIELD_BG, borderRadius: "var(--scout-radius)", border: ONBOARDING_FIELD_BORDER }}>
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
                  One thing to know
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

      {!loading && data && (
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
            Sound like you?
          </p>
          <div className="onboarding-readback-actions">
            <button
              className="onboarding-cta"
              onClick={() => onConfirm(data)}
              style={{ ...PRIMARY_CTA, flex: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.86")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              {confirmLabel ?? "That's right →"}
            </button>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                style={{
                  padding: "14px 24px",
                  background: ONBOARDING_FIELD_BG,
                  color: ONBOARDING_TEXT,
                  border: ONBOARDING_FIELD_BORDER,
                  borderRadius: "var(--scout-radius)",
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
                ← Go back
              </button>
            ) : (
              <button
                className="onboarding-cta"
                onClick={onRefine}
                style={{
                  padding: "14px 24px",
                  background: ONBOARDING_FIELD_BG,
                  color: ONBOARDING_TEXT,
                  border: ONBOARDING_FIELD_BORDER,
                  borderRadius: "var(--scout-radius)",
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
                Try a different resume
              </button>
            )}
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
              borderRadius: "var(--scout-radius)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 3px 10px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "var(--scout-radius)",
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
              ...PRIMARY_CTA,
              padding: "15px 32px",
              fontSize: 15,
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

const JOB_TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "3-6mo", label: "In the next 3–6 months" },
  { value: "open", label: "Whenever the right role appears" },
];

/* ──────────────────────────────────────────────────────────────
   Screen 2 — Target Roles
   ────────────────────────────────────────────────────────────── */
interface TargetRolesProps {
  selectedTitles: string[];
  suggestedTitles?: string[];
  suggestionLabel?: string;
  prioritizedCategories?: string[];
  suggestedCategories?: string[];
  onAddCategory?: (category: string) => void;
  onRemoveCategory?: (category: string) => void;
  onAddTitle: (title: string) => void;
  onRemoveTitle: (title: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

function SuggestedForYouChips({
  label = "Suggested for you",
  items,
  exclude,
  onPick,
}: {
  label?: string;
  items: string[];
  exclude: string[];
  onPick: (item: string) => void;
}) {
  const excludeLower = new Set(exclude.map((item) => item.toLowerCase()));
  const visible = items.filter((item) => !excludeLower.has(item.toLowerCase())).slice(0, 5);
  if (!visible.length) return null;

  return (
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
        {label}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {visible.map((item) => (
          <button
            key={item}
            type="button"
            className="onboarding-chip"
            onClick={() => onPick(item)}
            style={{
              padding: "8px 14px",
              background: ONBOARDING_FIELD_BG,
              border: ONBOARDING_FIELD_BORDER,
              borderRadius: "var(--scout-radius)",
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 500,
              color: ONBOARDING_TEXT,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
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
        borderRadius: "var(--scout-radius)",
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
  suggestionLabel = "Suggested from your resume",
  onAddTitle,
  onRemoveTitle,
  onDropdownOpenChange,
}: {
  selectedTitles: string[];
  suggestedTitles: string[];
  suggestionLabel?: string;
  onAddTitle: (title: string) => void;
  onRemoveTitle: (title: string) => void;
  onDropdownOpenChange?: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readbackSuggestions = suggestedTitles.filter((t) => !selectedTitles.includes(t));

  const dropdownOptions = useMemo(() => {
    return mergeRoleSuggestions(query, readbackSuggestions, 10).filter(
      (t) => !selectedTitles.includes(t)
    );
  }, [query, readbackSuggestions, selectedTitles]);

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
    if (!normalized || selectedTitles.includes(normalized)) return false;
    if (selectedTitles.length >= 10) return false;
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

      {readbackSuggestions.length > 0 && (
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
            {suggestionLabel}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {readbackSuggestions.slice(0, 5).map((title) => (
              <button
                key={title}
                type="button"
                className="onboarding-chip"
                onClick={() => pickOption(title)}
                style={{
                  padding: "8px 14px",
                  background: ONBOARDING_FIELD_BG,
                  border: ONBOARDING_FIELD_BORDER,
                  borderRadius: "var(--scout-radius)",
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
          Target roles · {selectedTitles.length} selected
        </label>
        <input
          id="target-role-input"
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Start typing a role title…"
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
            borderRadius: "var(--scout-radius)",
            background: ONBOARDING_FIELD_BG,
            fontFamily: "var(--font-ui)",
            fontSize: 16,
            fontWeight: 500,
            color: ONBOARDING_TEXT,
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        {open && dropdownOptions.length > 0 && (
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
              borderRadius: "var(--scout-radius)",
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
                    borderRadius: "var(--scout-radius)",
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

      {query.trim() && dropdownOptions.length === 0 && (
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

      {!query && (
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          {TARGET_ROLE_SUGGESTIONS.length}+ common titles — start typing, or pick a suggestion below.
        </p>
      )}
    </div>
  );
}

export function ScreenTargetRoles({
  selectedTitles,
  suggestedTitles = [],
  suggestionLabel = "Suggested for you",
  prioritizedCategories = [],
  suggestedCategories = [],
  onAddCategory,
  onRemoveCategory,
  onAddTitle,
  onRemoveTitle,
  onContinue,
  onSkip,
  onBack,
}: TargetRolesProps) {
  const canContinue = selectedTitles.length > 0;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [allCategories, setAllCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!categoriesOpen || allCategories.length) return;
    void fetch("/api/jobs/categories")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data: { categories?: string[] }) => setAllCategories(data.categories ?? []))
      .catch(() => {});
  }, [categoriesOpen, allCategories.length]);

  const categoryPool = [...new Set([...allCategories, ...suggestedCategories])];
  const filteredCategories = categoryPool.filter(
    (cat) =>
      !prioritizedCategories.some((s) => s.toLowerCase() === cat.toLowerCase()) &&
      (!categoryQuery.trim() || cat.toLowerCase().includes(categoryQuery.trim().toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <AboutYouIntro
        title="What roles are you targeting?"
        body="Pick the roles you want — tap a suggestion below or search for a title."
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
          suggestionLabel={suggestionLabel}
          onAddTitle={onAddTitle}
          onRemoveTitle={onRemoveTitle}
          onDropdownOpenChange={setDropdownOpen}
        />

        {(suggestedCategories.length > 0 || prioritizedCategories.length > 0 || onAddCategory) && onAddCategory && onRemoveCategory && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: ONBOARDING_FIELD_BORDER }}>
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                fontWeight: 600,
                color: ONBOARDING_LABEL_COLOR,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
                marginBottom: 10,
                marginTop: 0,
              }}
            >
              Job categories
            </p>
            {prioritizedCategories.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {prioritizedCategories.map((cat) => (
                  <span
                    key={cat}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: "rgba(26,58,47,0.08)",
                      border: "1.5px solid rgba(26,58,47,0.25)",
                      borderRadius: "var(--scout-radius)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1A3A2F",
                    }}
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => onRemoveCategory(cat)}
                      aria-label={`Remove ${cat}`}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#1A3A2F" }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <SuggestedForYouChips
              items={suggestedCategories}
              exclude={prioritizedCategories}
              onPick={onAddCategory}
            />
            {!categoriesOpen ? (
              <button
                type="button"
                onClick={() => setCategoriesOpen(true)}
                style={{
                  padding: "8px 14px",
                  background: "transparent",
                  color: "#1A3A2F",
                  border: ONBOARDING_FIELD_BORDER,
                  borderRadius: "var(--scout-radius)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                + Add category
              </button>
            ) : (
              <div>
                <input
                  autoFocus
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                  placeholder="Filter categories…"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: ONBOARDING_FIELD_BORDER,
                    borderRadius: "var(--scout-radius)",
                    background: ONBOARDING_FIELD_BG,
                    fontFamily: "var(--font-ui)",
                    fontSize: 15,
                    marginBottom: 8,
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {filteredCategories.slice(0, 8).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        onAddCategory(cat);
                        setCategoryQuery("");
                      }}
                      style={{
                        padding: "8px 12px",
                        background: ONBOARDING_FIELD_BG,
                        border: ONBOARDING_FIELD_BORDER,
                        borderRadius: "var(--scout-radius)",
                        fontFamily: "var(--font-ui)",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!canContinue && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" onClick={onSkip} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 0 }}>
              Skip for now
            </button>
            {onBack && (
              <button type="button" onClick={onBack} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 0 }}>
                ← Back
              </button>
            )}
          </div>
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
          {onBack && (
            <button type="button" onClick={onBack} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 12 }}>
              ← Back
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ScreenOnboardingPriorityRole({
  targetRoles,
  priorityRole,
  onPriorityRoleChange,
  onContinue,
  onSkip,
  onBack,
}: {
  targetRoles: string[];
  priorityRole: string;
  onPriorityRoleChange: (role: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <ScreenOnboardingQuestion
      title="Which role matters most right now?"
      body="If a job matches several of your target roles, we'll rank it higher when it fits this one. Skip to treat all roles equally."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
      skipLabel="No priority — treat all equally"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {targetRoles.map((role) =>
          onboardingListOption(
            priorityRole === role,
            () => onPriorityRoleChange(priorityRole === role ? "" : role),
            role,
          ),
        )}
      </div>
    </ScreenOnboardingQuestion>
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

export type OnboardingCompanySuggestion = {
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  type: string | null;
};

interface TargetCompaniesProps {
  selectedCompanies: OnboardingCompanyPick[];
  targetRoles: string[];
  prioritizedRoles?: string[];
  readbackData?: ReadBackData | null;
  onAddCompany: (company: OnboardingCompanyPick) => void;
  onRemoveCompany: (catalogSlug: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

function suggestionToPick(
  item: CompanySuggestion | OnboardingCompanySuggestion,
): OnboardingCompanyPick {
  return {
    catalogSlug: item.catalogSlug,
    name: item.name,
    website: item.website,
    careersUrl: item.careersUrl,
    type: item.type,
  };
}

function OnboardingSuggestedCompanies({
  targetRoles,
  prioritizedRoles,
  readbackData,
  selectedCompanies,
  onAddCompany,
}: {
  targetRoles: string[];
  prioritizedRoles: string[];
  readbackData: ReadBackData | null;
  selectedCompanies: OnboardingCompanyPick[];
  onAddCompany: (company: OnboardingCompanyPick) => void;
}) {
  const [recommendations, setRecommendations] = useState<OnboardingCompanySuggestion[]>([]);
  const [personalized, setPersonalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const max = ONBOARDING_MAX_TARGET_COMPANIES;
  const atMax = selectedCompanies.length >= max;
  const selectedSlugs = useMemo(
    () => new Set(selectedCompanies.map((c) => c.catalogSlug)),
    [selectedCompanies],
  );

  const signalKey = useMemo(
    () =>
      JSON.stringify({
        targetRoles,
        prioritizedRoles,
        readbackRoles: readbackData?.targetRoles?.map((r) => r.role) ?? [],
      }),
    [targetRoles, prioritizedRoles, readbackData],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void fetch("/api/onboarding/company-recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetRoles,
        prioritizedRoles,
        readbackData,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { recommendations?: OnboardingCompanySuggestion[]; personalized?: boolean } | null) => {
        if (cancelled) return;
        setRecommendations(data?.recommendations ?? []);
        setPersonalized(data?.personalized ?? false);
      })
      .catch(() => {
        if (!cancelled) {
          setRecommendations([]);
          setPersonalized(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [signalKey, targetRoles, prioritizedRoles, readbackData]);

  const visible = recommendations.filter((rec) => !selectedSlugs.has(rec.catalogSlug));
  if (!loading && visible.length === 0) return null;

  return (
    <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: ONBOARDING_FIELD_BORDER }}>
      <p
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 12,
          fontWeight: 600,
          color: ONBOARDING_TEXT_SECONDARY,
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          marginBottom: 10,
          marginTop: 0,
        }}
      >
        {personalized ? "Suggested for you" : "Popular companies"}
      </p>

      {loading && visible.length === 0 ? (
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: ONBOARDING_TEXT_SECONDARY, margin: 0 }}>
          Loading suggestions…
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {visible.map((rec) => (
            <button
              key={rec.catalogSlug}
              type="button"
              disabled={atMax}
              onClick={() => onAddCompany(suggestionToPick(rec))}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                border: ONBOARDING_FIELD_BORDER,
                borderRadius: "var(--scout-radius)",
                background: atMax ? "rgba(247,245,242,0.6)" : ONBOARDING_FIELD_BG,
                textAlign: "left",
                cursor: atMax ? "not-allowed" : "pointer",
                opacity: atMax ? 0.7 : 1,
              }}
            >
              <CompanyLogo
                name={rec.name}
                website={rec.website}
                careersUrl={rec.careersUrl}
                size={32}
                borderRadius={6}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: ONBOARDING_TEXT,
                  }}
                >
                  {rec.name}
                </span>
                {rec.type ? (
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-ui)",
                      fontSize: 12,
                      fontWeight: 400,
                      color: ONBOARDING_TEXT_SECONDARY,
                      marginTop: 2,
                    }}
                  >
                    {rec.type}
                  </span>
                ) : null}
              </span>
              {!atMax && (
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: ONBOARDING_TEXT_SECONDARY,
                  }}
                >
                  Add
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
        borderRadius: "var(--scout-radius)",
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
    if (!query.trim() || query.trim().length < 2) {
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
          placeholder={atMax ? "Remove one to add another" : "Search companies — type at least 2 letters…"}
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
            borderRadius: "var(--scout-radius)",
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
              borderRadius: "var(--scout-radius)",
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
          Search companies — type at least 2 letters. We&apos;ll scan each one for roles that match your titles.
        </p>
      )}
    </div>
  );
}

export function ScreenTargetCompanies({
  selectedCompanies,
  targetRoles,
  prioritizedRoles = [],
  readbackData = null,
  onAddCompany,
  onRemoveCompany,
  onContinue,
  onSkip,
  onBack,
}: TargetCompaniesProps) {
  const canContinue = selectedCompanies.length > 0;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const rolesPreview = targetRoles.slice(0, 2).join(", ");

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <AboutYouIntro
        title="Any companies on your list?"
        body={`Add up to ${ONBOARDING_MAX_TARGET_COMPANIES} employers you want to watch. We'll scan their boards for roles that match your titles.`}
      />

      {targetRoles.length > 0 && (
        <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.15s", padding: "16px 18px" }}>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: ONBOARDING_TEXT_SECONDARY, lineHeight: 1.55, margin: 0 }}>
            When we find a match for{" "}
            <span style={{ fontWeight: 600, color: ONBOARDING_TEXT }}>
              {rolesPreview}
              {targetRoles.length > 2 ? ` +${targetRoles.length - 2} more` : ""}
            </span>
            , you&apos;ll see it here — no daily job-board checks needed.
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
        <OnboardingSuggestedCompanies
          targetRoles={targetRoles}
          prioritizedRoles={prioritizedRoles}
          readbackData={readbackData}
          selectedCompanies={selectedCompanies}
          onAddCompany={onAddCompany}
        />

        <TargetCompanyAutocomplete
          selectedCompanies={selectedCompanies}
          onAddCompany={onAddCompany}
          onRemoveCompany={onRemoveCompany}
          onDropdownOpenChange={setDropdownOpen}
        />

        {!canContinue && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" onClick={onSkip} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 0 }}>
              Skip for now
            </button>
            {onBack && (
              <button type="button" onClick={onBack} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 0 }}>
                ← Back
              </button>
            )}
          </div>
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
          {onBack && (
            <button type="button" onClick={onBack} style={{ ...ONBOARDING_SKIP_LINK, marginTop: 12 }}>
              ← Back
            </button>
          )}
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
        borderRadius: "var(--scout-radius)",
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
      {body ? (
        <p style={{ ...ONBOARDING_BODY, fontSize: "clamp(0.9375rem, 2.5vw, 1rem)", lineHeight: 1.65, margin: 0, color: ONBOARDING_TEXT_SECONDARY }}>
          {body}
        </p>
      ) : null}
    </div>
  );
}

function AboutYouActions({
  onContinue,
  onSkip,
  onBack,
  nudge,
  continueDisabled,
  skipLabel = "Skip for now — fill this in on your profile later",
}: {
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  nudge?: string;
  continueDisabled?: boolean;
  skipLabel?: string;
}) {
  return (
    <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.35s" }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          className="onboarding-cta"
          onClick={onContinue}
          disabled={continueDisabled}
          style={{
            ...PRIMARY_CTA,
            width: "100%",
            opacity: continueDisabled ? 0.45 : 1,
            cursor: continueDisabled ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => { if (!continueDisabled) e.currentTarget.style.opacity = "0.86"; }}
          onMouseLeave={(e) => { if (!continueDisabled) e.currentTarget.style.opacity = "1"; }}
        >
          Continue →
        </button>
        {onBack && (
          <button type="button" onClick={onBack} style={{ ...ABOUT_YOU_SKIP_LINK, marginTop: 0, textAlign: "center" as const }}>
            ← Back
          </button>
        )}
        {onSkip && (
          <button type="button" onClick={onSkip} style={{ ...ABOUT_YOU_SKIP_LINK, color: ONBOARDING_TEXT_SECONDARY, marginTop: 0 }}>
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function onboardingSelectStyle(hasValue: boolean): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 48,
    padding: "11px 36px 11px 14px",
    border: ONBOARDING_FIELD_BORDER,
    borderRadius: "var(--scout-radius)",
    background: ONBOARDING_FIELD_BG,
    fontFamily: "var(--font-ui)",
    fontSize: 16,
    fontWeight: 500,
    color: hasValue ? ONBOARDING_TEXT : ONBOARDING_TEXT_SECONDARY,
    cursor: "pointer",
    appearance: "none",
    outline: "none",
    boxSizing: "border-box",
  };
}

function OnboardingSelectChevron() {
  return (
    <svg style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="12" height="7" viewBox="0 0 12 7" fill="none">
      <path d="M1 1L6 6L11 1" stroke={ONBOARDING_TEXT_SECONDARY} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ScreenOnboardingQuestion({
  title,
  body,
  children,
  onContinue,
  onSkip,
  onBack,
  continueDisabled,
  skipLabel,
  contentElevated,
}: {
  title: string;
  body?: string;
  children: React.ReactNode;
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  continueDisabled?: boolean;
  skipLabel?: string;
  contentElevated?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <AboutYouIntro title={title} body={body ?? ""} />
      <div
        className="anim-fade-up"
        style={{
          ...ONBOARDING_CARD,
          animationDelay: "0.2s",
          ...(contentElevated ? { position: "relative", zIndex: 30 } : {}),
        }}
      >
        {children}
      </div>
      <AboutYouActions
        onContinue={onContinue}
        onSkip={onSkip}
        onBack={onBack}
        continueDisabled={continueDisabled}
        skipLabel={skipLabel}
      />
    </div>
  );
}

function onboardingListOption(
  selected: boolean,
  onClick: () => void,
  label: string,
  hint?: string,
) {
  return (
    <button
      type="button"
      className="onboarding-chip"
      onClick={onClick}
      style={{
        padding: "14px 18px",
        background: selected ? "#1A3A2F" : ONBOARDING_FIELD_BG,
        color: selected ? "#E8D5A3" : ONBOARDING_TEXT,
        border: selected ? "1.5px solid #1A3A2F" : ONBOARDING_FIELD_BORDER,
        borderRadius: "var(--scout-radius)",
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
      <span style={{ display: "block" }}>{label}</span>
      {hint && (
        <span
          style={{
            display: "block",
            marginTop: 4,
            fontSize: 13,
            fontWeight: 400,
            color: selected ? "rgba(232,213,163,0.85)" : ONBOARDING_TEXT_SECONDARY,
            lineHeight: 1.45,
          }}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

export function ScreenOnboardingLocation({
  targetMarket,
  locationHint,
  onTargetMarketChange,
  onContinue,
  onBack,
}: {
  targetMarket: string;
  locationHint?: string | null;
  onTargetMarketChange: (v: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <ScreenOnboardingQuestion
      title="Where are you based?"
      body="We prioritize roles near you — set your remote preference on the next step."
      onContinue={onContinue}
      onBack={onBack}
      continueDisabled={!targetMarket.trim()}
      contentElevated={dropdownOpen}
    >
      <LocationAutocompleteInput
        value={targetMarket}
        onChange={onTargetMarketChange}
        locationHint={locationHint}
        placeholder="Start typing a city…"
        fieldBorder={ONBOARDING_FIELD_BORDER}
        fieldBg={ONBOARDING_FIELD_BG}
        textColor={ONBOARDING_TEXT}
        textSecondary={ONBOARDING_TEXT_SECONDARY}
        labelColor={ONBOARDING_LABEL_COLOR}
        onDropdownOpenChange={setDropdownOpen}
      />
    </ScreenOnboardingQuestion>
  );
}

export function ScreenOnboardingWorkArrangement({
  workArrangement,
  onWorkArrangementChange,
  onContinue,
  onSkip,
  onBack,
}: {
  workArrangement: WorkArrangementId;
  onWorkArrangementChange: (v: WorkArrangementId) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <ScreenOnboardingQuestion
      title="How do you want to work?"
      body="We filter listings that clash with remote, hybrid, or on-site preferences."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ONBOARDING_WORK_ARRANGEMENTS.map(({ value, label, hint }) =>
          onboardingListOption(
            workArrangement === value,
            () => onWorkArrangementChange(workArrangement === value ? "" : value),
            label,
            hint,
          ),
        )}
      </div>
    </ScreenOnboardingQuestion>
  );
}

export function ScreenOnboardingRelocation({
  relocation,
  onRelocationChange,
  onContinue,
  onSkip,
  onBack,
}: {
  relocation: RelocationId;
  onRelocationChange: (v: RelocationId) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <ScreenOnboardingQuestion
      title="Would you relocate for the right role?"
      body="This expands or tightens which geographies we show in your feed."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ONBOARDING_RELOCATION_OPTIONS.map(({ value, label }) =>
          onboardingListOption(
            relocation === value,
            () => onRelocationChange(relocation === value ? "" : value),
            label,
          ),
        )}
      </div>
    </ScreenOnboardingQuestion>
  );
}

export function ScreenOnboardingVisa({
  visaNeed,
  onVisaNeedChange,
  onContinue,
  onSkip,
  onBack,
}: {
  visaNeed: VisaNeedId;
  onVisaNeedChange: (v: VisaNeedId) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <ScreenOnboardingQuestion
      title="Do you need visa sponsorship?"
      body="When yes, we prioritize employers that sponsor visas."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ONBOARDING_VISA_OPTIONS.map(({ value, label }) =>
          onboardingListOption(
            visaNeed === value,
            () => onVisaNeedChange(visaNeed === value ? "" : value),
            label,
          ),
        )}
      </div>
    </ScreenOnboardingQuestion>
  );
}

export function ScreenOnboardingSalary({
  targetSalary,
  onTargetSalaryChange,
  onContinue,
  onSkip,
  onBack,
}: {
  targetSalary: string;
  onTargetSalaryChange: (v: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <ScreenOnboardingQuestion
      title="What's your target salary floor?"
      body="We filter out roles below this range when compensation data is available."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div style={{ position: "relative", maxWidth: 360 }}>
        <select
          value={targetSalary}
          onChange={(e) => onTargetSalaryChange(e.target.value)}
          style={onboardingSelectStyle(!!targetSalary)}
        >
          <option value="">Select a range</option>
          {SALARY_RANGES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <OnboardingSelectChevron />
      </div>
    </ScreenOnboardingQuestion>
  );
}

export function ScreenOnboardingTimeline({
  jobTimeline,
  onJobTimelineChange,
  onContinue,
  onSkip,
  onBack,
}: {
  jobTimeline: string;
  onJobTimelineChange: (v: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <ScreenOnboardingQuestion
      title="When do you want to land something?"
      body="Fresh postings rank higher when you're moving fast."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {JOB_TIMELINES.map(({ value, label }) =>
          onboardingListOption(
            jobTimeline === value,
            () => onJobTimelineChange(jobTimeline === value ? "" : value),
            label,
          ),
        )}
      </div>
    </ScreenOnboardingQuestion>
  );
}

export function ScreenOnboardingAvoidRoles({
  deprioritizedCategories,
  suggestedCategories = [],
  onAddAvoidCategory,
  onRemoveAvoidCategory,
  onContinue,
  onSkip,
  onBack,
}: {
  deprioritizedCategories: string[];
  suggestedCategories?: string[];
  onAddAvoidCategory: (category: string) => void;
  onRemoveAvoidCategory: (category: string) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [allCategories, setAllCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!categoriesOpen || allCategories.length) return;
    void fetch("/api/jobs/categories")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data: { categories?: string[] }) => setAllCategories(data.categories ?? []))
      .catch(() => {});
  }, [categoriesOpen, allCategories.length]);

  const categoryPool = [...new Set([...allCategories, ...suggestedCategories])];
  const filteredCategories = categoryPool.filter(
    (cat) =>
      !deprioritizedCategories.some((s) => s.toLowerCase() === cat.toLowerCase()) &&
      (!categoryQuery.trim() || cat.toLowerCase().includes(categoryQuery.trim().toLowerCase())),
  );

  return (
    <ScreenOnboardingQuestion
      title="Any job categories to avoid?"
      body="We'll still show some matches, but sort these lower when they appear."
      onContinue={onContinue}
      onSkip={onSkip}
      onBack={onBack}
      skipLabel="None — continue"
    >
      <SuggestedForYouChips
        label="Suggested for you"
        items={suggestedCategories}
        exclude={deprioritizedCategories}
        onPick={onAddAvoidCategory}
      />
      {deprioritizedCategories.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {deprioritizedCategories.map((cat) => (
            <span
              key={cat}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "rgba(196,87,74,0.1)",
                border: "1.5px solid rgba(196,87,74,0.5)",
                borderRadius: "var(--scout-radius)",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 600,
                color: "#C4574A",
              }}
            >
              {cat}
              <button
                type="button"
                onClick={() => onRemoveAvoidCategory(cat)}
                aria-label={`Remove ${cat}`}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 16, lineHeight: 1, color: "#C4574A" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {!categoriesOpen ? (
        <button
          type="button"
          onClick={() => setCategoriesOpen(true)}
          style={{
            padding: "8px 14px",
            background: "transparent",
            color: "#1A3A2F",
            border: ONBOARDING_FIELD_BORDER,
            borderRadius: "var(--scout-radius)",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + Add category to avoid
        </button>
      ) : (
        <div>
          <input
            autoFocus
            value={categoryQuery}
            onChange={(e) => setCategoryQuery(e.target.value)}
            placeholder="Filter categories…"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: ONBOARDING_FIELD_BORDER,
              borderRadius: "var(--scout-radius)",
              background: ONBOARDING_FIELD_BG,
              fontFamily: "var(--font-ui)",
              fontSize: 15,
              marginBottom: 8,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {filteredCategories.slice(0, 8).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  onAddAvoidCategory(cat);
                  setCategoryQuery("");
                }}
                style={{
                  padding: "8px 12px",
                  background: ONBOARDING_FIELD_BG,
                  border: ONBOARDING_FIELD_BORDER,
                  borderRadius: "var(--scout-radius)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
      {deprioritizedCategories.length === 0 && (
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          Leave blank if you&apos;re open to everything.
        </p>
      )}
    </ScreenOnboardingQuestion>
  );
}
/* ──────────────────────────────────────────────────────────────
   Final Summary Screen
   ────────────────────────────────────────────────────────────── */

export interface FinalSummaryProfile {
  headline?: string;
  targetRoles: string[];
  prioritizedCategories?: string[];
  targetMarket: string;
  workArrangement: WorkArrangementId;
  targetSalary: string;
  jobTimeline: string;
  deprioritizedCategories: string[];
  visaNeed: VisaNeedId;
}

function summaryLabel<T extends string>(v: T, options: { value: T; label: string }[]): string {
  return options.find((o) => o.value === v)?.label ?? v;
}

export function ScreenFinalSummary({
  readbackData,
  profile,
  onConfirm,
  onBack,
  confirming = false,
}: {
  readbackData: ReadBackData | null;
  profile: FinalSummaryProfile;
  onConfirm: () => void;
  onBack: () => void;
  confirming?: boolean;
}) {
  const hasAI = readbackData != null;

  return (
    <div className="flex flex-col gap-5 onboarding-screen-gap">
      <OnboardingEyebrowIntro
        eyebrow="Almost done"
        title="Here's your full profile."
        body="We'll use this to run your search — does everything look right?"
      />

      {hasAI && (
        <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.2s" }}>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: ONBOARDING_LABEL_COLOR, letterSpacing: "0.6px", textTransform: "uppercase" as const, marginBottom: 12, marginTop: 0 }}>
            Your profile read
          </p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 400, color: "#2A2218", lineHeight: 1.75, marginBottom: 16, marginTop: 0 }}>
            {readbackData.picture}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {readbackData.strengths.map((s) => (
              <span key={s} style={{ padding: "6px 12px", background: ONBOARDING_FIELD_BG, border: ONBOARDING_FIELD_BORDER, borderRadius: "var(--scout-radius)", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, color: ONBOARDING_TEXT }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: hasAI ? "0.35s" : "0.2s" }}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: ONBOARDING_LABEL_COLOR, letterSpacing: "0.6px", textTransform: "uppercase" as const, marginBottom: 16, marginTop: 0 }}>
          Your search setup
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {profile.headline && (
            <div>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginBottom: 6, marginTop: 0 }}>One-liner</p>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: ONBOARDING_TEXT, margin: 0, lineHeight: 1.6 }}>{profile.headline}</p>
            </div>
          )}

          {profile.targetRoles.length > 0 && (
            <div>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginBottom: 6, marginTop: 0 }}>Targeting</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {profile.targetRoles.map((r) => (
                  <span key={r} style={{ padding: "6px 12px", background: "rgba(26,58,47,0.08)", border: "1.5px solid rgba(26,58,47,0.2)", borderRadius: "var(--scout-radius)", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "#1A3A2F" }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(profile.prioritizedCategories?.length ?? 0) > 0 && (
            <div>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginBottom: 6, marginTop: 0 }}>Categories</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {profile.prioritizedCategories!.map((c) => (
                  <span key={c} style={{ padding: "6px 12px", background: "rgba(26,58,47,0.08)", border: "1.5px solid rgba(26,58,47,0.2)", borderRadius: "var(--scout-radius)", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "#1A3A2F" }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hasAI && readbackData.targetRoles.length > 0 && (
            <div>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginBottom: 6, marginTop: 0 }}>Roles that fit your background</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readbackData.targetRoles.slice(0, 5).map((r) => (
                  <div key={r.role} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: ONBOARDING_TEXT }}>{r.role}</span>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: ONBOARDING_TEXT_SECONDARY }}>{r.fit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {profile.targetMarket && (
              <div>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginBottom: 3, marginTop: 0 }}>Location</p>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: ONBOARDING_TEXT, margin: 0 }}>{profile.targetMarket}</p>
              </div>
            )}
            {profile.workArrangement && (
              <div>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginBottom: 3, marginTop: 0 }}>Work style</p>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: ONBOARDING_TEXT, margin: 0 }}>
                  {summaryLabel(profile.workArrangement, ONBOARDING_WORK_ARRANGEMENTS)}
                </p>
              </div>
            )}
            {profile.targetSalary && (
              <div>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginBottom: 3, marginTop: 0 }}>Salary floor</p>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: ONBOARDING_TEXT, margin: 0 }}>{profile.targetSalary}</p>
              </div>
            )}
            {profile.jobTimeline && (
              <div>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginBottom: 3, marginTop: 0 }}>Timeline</p>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: ONBOARDING_TEXT, margin: 0 }}>
                  {summaryLabel(profile.jobTimeline, JOB_TIMELINES)}
                </p>
              </div>
            )}
          </div>

          {profile.deprioritizedCategories.length > 0 && (
            <div>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: ONBOARDING_TEXT_SECONDARY, marginBottom: 6, marginTop: 0 }}>Deprioritizing</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {profile.deprioritizedCategories.map((c) => (
                  <span key={c} style={{ padding: "6px 12px", background: "rgba(196,87,74,0.08)", border: "1.5px solid rgba(196,87,74,0.3)", borderRadius: "var(--scout-radius)", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, color: "#C4574A" }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="anim-fade-up" style={{ ...ONBOARDING_CARD, animationDelay: "0.5s" }}>
        <button
          className="onboarding-cta"
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          style={{
            ...PRIMARY_CTA,
            width: "100%",
            marginBottom: 10,
            opacity: confirming ? 0.65 : 1,
            cursor: confirming ? "wait" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!confirming) e.currentTarget.style.opacity = "0.86";
          }}
          onMouseLeave={(e) => {
            if (!confirming) e.currentTarget.style.opacity = "1";
          }}
        >
          {confirming ? "Setting up…" : "Looks good, let's go →"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={confirming}
          style={{ display: "block", width: "100%", padding: "12px 0", background: "none", border: "none", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: ONBOARDING_TEXT_SECONDARY, cursor: confirming ? "not-allowed" : "pointer", textAlign: "center" as const, opacity: confirming ? 0.5 : 1 }}
        >
          ← Go back and edit
        </button>
      </div>
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
        borderRadius: "var(--scout-radius)",
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
          Try your first
          <br />
          job match.
        </h2>
        <p style={{ ...ONBOARDING_BODY, fontSize: "clamp(1rem, 2.5vw, 1.125rem)", maxWidth: 440, margin: 0, color: ONBOARDING_TEXT_SECONDARY }}>
          Paste a job listing URL. We&apos;ll read the posting and score how well your resume fits.
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
                  borderRadius: "var(--scout-radius)",
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
              borderRadius: "var(--scout-radius)",
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
              : "Reading the listing…"}
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
              borderRadius: "var(--scout-radius)",
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
                  borderRadius: "var(--scout-radius)",
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
                  background: "var(--scout-inset)",
                  borderRadius: "var(--scout-radius)",
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
                    We&apos;ll save this job and open your resume with this match score.
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

export type SetupStepStatus = "pending" | "active" | "done" | "skipped" | "failed";

export interface SetupStep {
  id: string;
  label: string;
  status: SetupStepStatus;
}

export function ScreenSetup({ steps }: { steps: SetupStep[] }) {
  return (
    <div className="anim-fade-up onboarding-screen-gap" style={ONBOARDING_CARD}>
      <h2 style={{ ...DISPLAY_H2, lineHeight: 1.04, marginBottom: 12, marginTop: 0 }}>
        Setting up your workspace
      </h2>
      <p style={{ ...ONBOARDING_BODY, margin: "0 0 24px", color: ONBOARDING_TEXT_SECONDARY, fontSize: "clamp(0.9375rem, 2.5vw, 1rem)" }}>
        This usually takes a minute. Keep this tab open.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((step) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSkipped = step.status === "skipped";
          const isFailed = step.status === "failed";
          return (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderRadius: "var(--scout-radius)",
                border: `1.5px solid ${
                  isDone ? "#1A3A2F" : isFailed ? "#C0392B" : isActive ? "rgba(26,58,47,0.35)" : "rgba(26,58,47,0.12)"
                }`,
                background: isDone ? "rgba(26,58,47,0.06)" : isFailed ? "rgba(192,57,43,0.06)" : ONBOARDING_FIELD_BG,
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
                  background: isDone ? "#1A3A2F" : isFailed ? "#C0392B" : "rgba(26,58,47,0.08)",
                  color: isDone ? "#E8D5A3" : isFailed ? "#FFFFFF" : ONBOARDING_TEXT_SECONDARY,
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {isDone ? "✓" : isFailed ? "!" : isSkipped ? "—" : isActive ? "…" : ""}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  fontWeight: isActive || isDone || isFailed ? 600 : 500,
                  color: isSkipped ? ONBOARDING_TEXT_SECONDARY : isFailed ? "#8B2E2E" : ONBOARDING_TEXT,
                }}
              >
                {step.label}
                {isFailed ? " — saved your URL; import failed" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Pre-screen: Career Intent — "What brings you here?"
   ────────────────────────────────────────────────────────────── */
const CAREER_INTENT_OPTIONS = [
  { id: "new-industry", label: "I'm trying to break into a new industry" },
  { id: "new-role", label: "I'm targeting a role I haven't held before" },
  { id: "active-search", label: "I'm actively applying and need to move fast" },
  { id: "exploring", label: "I'm figuring out what I want next" },
] as const;

export type CareerIntentId = typeof CAREER_INTENT_OPTIONS[number]["id"];

export function ScreenCareerIntent({ onSelect }: { onSelect: (id: CareerIntentId) => void }) {
  const [selected, setSelected] = useState<CareerIntentId | null>(null);
  const [hoveredId, setHoveredId] = useState<CareerIntentId | null>(null);

  const handleSelect = (id: CareerIntentId) => {
    setSelected(id);
    onSelect(id);
  };

  return (
    <div className="anim-fade-up" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <OnboardingHeroIntro
        title="What brings you here?"
        body="Pick the one that fits best — it helps us point you in the right direction."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CAREER_INTENT_OPTIONS.map((opt) => {
          const isSelected = selected === opt.id;
          const isHovered = hoveredId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              onMouseEnter={() => setHoveredId(opt.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                ...ONBOARDING_CARD,
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                border: isSelected ? "2px solid #1A3A2F" : isHovered ? "1.5px solid rgba(26,58,47,0.45)" : ONBOARDING_FIELD_BORDER,
                background: isSelected
                  ? "rgba(26,58,47,0.06)"
                  : isHovered
                  ? "rgba(26,58,47,0.03)"
                  : ONBOARDING_FIELD_BG,
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                transition: "border-color 0.15s, background 0.15s",
                transform: isHovered && !isSelected ? "translateY(-1px)" : "none",
                boxShadow: isHovered && !isSelected ? "0 2px 8px rgba(26,58,47,0.08)" : "none",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 15,
                  fontWeight: isSelected || isHovered ? 600 : 500,
                  color: isSelected ? "#1A3A2F" : ONBOARDING_TEXT,
                  lineHeight: 1.45,
                  transition: "font-weight 0.1s, color 0.15s",
                }}
              >
                {opt.label}
              </span>
              {isSelected ? (
                <span style={{ color: "#1A3A2F", fontSize: 18, flexShrink: 0 }}>✓</span>
              ) : isHovered ? (
                <span style={{ color: "rgba(26,58,47,0.4)", fontSize: 16, flexShrink: 0 }}>→</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Pre-screen: One-liner — "Describe what you do"
   ────────────────────────────────────────────────────────────── */
export function ScreenOneLiner({
  initialValue = "",
  importBanner = null,
  onContinue,
  onBack,
  loading = false,
}: {
  initialValue?: string;
  importBanner?: { type: "success" | "error" | "info"; message: string } | null;
  onContinue: (text: string) => void;
  onBack: () => void;
  loading?: boolean;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const bannerStyles =
    importBanner?.type === "success"
      ? { border: "1px solid rgba(26,58,47,0.2)", background: "rgba(26,58,47,0.06)", color: "#1A3A2F" }
      : importBanner?.type === "error"
        ? { border: "1px solid rgba(192,57,43,0.25)", background: "rgba(192,57,43,0.06)", color: "#C0392B" }
        : { border: "1px solid rgba(26,58,47,0.16)", background: "rgba(26,58,47,0.05)", color: ONBOARDING_TEXT_SECONDARY };

  return (
    <div className="anim-fade-up" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <OnboardingHeroIntro
        title="What's your professional one-liner?"
        body="One sentence — your profile pitch. We'll use it to suggest roles, categories, and preferences."
      />
      {importBanner && (
        <div
          style={{
            ...ONBOARDING_CARD,
            marginBottom: 16,
            padding: "12px 14px",
            ...bannerStyles,
          }}
        >
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, margin: 0, lineHeight: 1.55 }}>
            {importBanner.message}
          </p>
        </div>
      )}
      <div style={ONBOARDING_CARD}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Strategy & Digital Transformation | Growth Systems Builder | MBA"
          rows={3}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 16px",
            border: ONBOARDING_FIELD_BORDER,
            borderRadius: "var(--scout-radius)",
            fontFamily: "var(--font-ui)",
            fontSize: 15,
            color: ONBOARDING_TEXT,
            background: ONBOARDING_FIELD_BG,
            resize: "none",
            outline: "none",
            lineHeight: 1.6,
            marginBottom: 16,
            boxSizing: "border-box",
            opacity: loading ? 0.6 : 1,
            transition: "opacity 0.2s",
          }}
        />
        <button
          type="button"
          onClick={() => value.trim() && onContinue(value.trim())}
          disabled={!value.trim() || loading}
          style={{
            ...PRIMARY_CTA,
            width: "100%",
            opacity: !value.trim() || loading ? 0.5 : 1,
            cursor: !value.trim() || loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(242,237,227,0.3)",
                  borderTopColor: "#F2EDE3",
                  borderRadius: "50%",
                  animation: "spin 0.75s linear infinite",
                  flexShrink: 0,
                }}
              />
              Analyzing…
            </>
          ) : (
            "Continue"
          )}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          style={ONBOARDING_SKIP_LINK}
        >
          ← Back
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
          borderRadius: "var(--scout-radius)",
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
