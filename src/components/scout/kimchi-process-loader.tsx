"use client";

import { fontSans } from "@/lib/typography";

export const KIMCHI_LOADER_PRESETS = {
  jobParse: {
    emoji: "🔍",
    title: "Reading this job listing…",
    hint: "It usually takes about 5–15 seconds.",
    durationSec: 12,
  },
  jobMatch: {
    emoji: "✨",
    title: "Analyzing your resume against this role…",
    hint: "It usually takes about 10–20 seconds.",
    durationSec: 18,
  },
  resumeTailor: {
    emoji: "✨",
    title: "Finalizing your new resume…",
    hint: "It usually takes about 10–20 seconds.",
    durationSec: 18,
  },
  resumeAnalysis: {
    emoji: "📊",
    title: "Analyzing your resume…",
    hint: "It usually takes about 10–20 seconds.",
    durationSec: 18,
  },
  coverLetter: {
    emoji: "✍️",
    title: "Writing your cover letter…",
    hint: "It usually takes about 10–20 seconds.",
    durationSec: 18,
  },
  linkedInImport: {
    emoji: "🔗",
    title: "Importing your LinkedIn profile…",
    hint: "It usually takes about 15–30 seconds.",
    durationSec: 24,
  },
  profileAnalysis: {
    emoji: "🧠",
    title: "Analyzing your profile…",
    hint: "It usually takes about 10–20 seconds.",
    durationSec: 18,
  },
  recommendations: {
    emoji: "🎯",
    title: "Finding roles that match you…",
    hint: "This usually takes a few seconds.",
    durationSec: 8,
  },
  onboardingBackground: {
    emoji: "👋",
    title: "Analyzing your background…",
    hint: "We're personalizing your workspace.",
    durationSec: 15,
  },
  resumeUpload: {
    emoji: "📄",
    title: "Reading your resume…",
    hint: "It usually takes about 10–20 seconds.",
    durationSec: 18,
  },
  resumeRegenerate: {
    emoji: "🔄",
    title: "Regenerating your tailored resume…",
    hint: "It usually takes about 10–20 seconds.",
    durationSec: 18,
  },
  strategyIntake: {
    emoji: "📋",
    title: "Parsing intake notes…",
    hint: "Extracting profile fields from your notes.",
    durationSec: 12,
  },
  careerStrategy: {
    emoji: "📊",
    title: "Building your career strategy…",
    hint: "This is a full strategy document — it can take 30–90 seconds.",
    durationSec: 75,
  },
} as const;

export type KimchiLoaderPreset = keyof typeof KIMCHI_LOADER_PRESETS;

export interface KimchiProcessLoaderProps {
  preset?: KimchiLoaderPreset;
  emoji?: string;
  title?: string;
  hint?: string;
  durationSec?: number;
  /** card = white panel; inline = compact strip; centered = card in a flex center wrapper */
  variant?: "card" | "inline" | "centered";
}

function LoaderStyles() {
  return (
    <style>{`
      @keyframes kpl-pulse-emoji {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.72; transform: scale(0.92); }
      }
      @keyframes kpl-loading-bar {
        from { width: 0%; }
        to { width: 92%; }
      }
    `}</style>
  );
}

export function KimchiProcessLoader({
  preset,
  emoji,
  title,
  hint,
  durationSec,
  variant = "card",
}: KimchiProcessLoaderProps) {
  const base = preset ? KIMCHI_LOADER_PRESETS[preset] : null;
  const resolvedEmoji = emoji ?? base?.emoji ?? "✨";
  const resolvedTitle = title ?? base?.title ?? "Working on it…";
  const resolvedHint = hint ?? base?.hint ?? "This usually takes a few seconds.";
  const barDuration = durationSec ?? base?.durationSec ?? 15;

  const inner = (
    <>
      <LoaderStyles />
      <div
        role="status"
        aria-live="polite"
        aria-label={resolvedTitle}
        style={{
          fontSize: variant === "inline" ? 28 : 36,
          marginBottom: variant === "inline" ? 12 : 24,
          lineHeight: 1,
          animation: "kpl-pulse-emoji 1.6s ease-in-out infinite",
        }}
      >
        {resolvedEmoji}
      </div>
      <div
        style={{
          height: 3,
          background: "rgba(0,0,0,0.06)",
          borderRadius: 2,
          marginBottom: variant === "inline" ? 14 : 28,
          overflow: "hidden",
          width: "100%",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "#1A3A2F",
            borderRadius: 2,
            animation: `kpl-loading-bar ${barDuration}s ease-out forwards`,
          }}
        />
      </div>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: variant === "inline" ? 15 : 17,
          fontWeight: 700,
          color: "#1A1A1A",
          margin: "0 0 8px",
          lineHeight: 1.35,
        }}
      >
        {resolvedTitle}
      </p>
      {resolvedHint ? (
        <p
          style={{
            fontFamily: fontSans,
            fontSize: variant === "inline" ? 13 : 14,
            color: "var(--scout-muted)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          ⓘ {resolvedHint}
        </p>
      ) : null}
    </>
  );

  if (variant === "inline") {
    return (
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          background: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 0,
          padding: "24px 28px",
          textAlign: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        }}
      >
        {inner}
      </div>
    );
  }

  const card = (
    <div
      style={{
        maxWidth: 440,
        width: "100%",
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 0,
        padding: variant === "centered" ? "40px 36px" : "48px 40px",
        textAlign: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}
    >
      {inner}
    </div>
  );

  if (variant === "centered") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 320,
          width: "100%",
        }}
      >
        {card}
      </div>
    );
  }

  return card;
}
