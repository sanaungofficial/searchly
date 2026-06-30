"use client";

import { fontSans, fontMono, color } from "@/lib/typography";

const sans = fontSans;
const mono = fontMono;

export interface MatchData {
  score: number;
  scoreLabel: string;
  jobTitle: string;
  resumeTitle: string;
  jobTitleMatch?: boolean;
  yoeRequired: string;
  yoeCandidate: string;
  yoeMatch: boolean;
  industries: string[];
  industryMatch: boolean;
  industryTags?: { label: string; matched: boolean }[];
  keywords: { text: string; matched: boolean }[];
  summaryNote: string;
  /** Profile/keyword comparison when AI is unavailable or failed. */
  _fallback?: boolean;
  _fallbackReason?: "no_ai" | "parse_error" | "ai_error";
}

export function matchDataToFitDisplay(data: MatchData): {
  matchScore: number;
  matchLabel: string;
  matchReasons: string[];
  matchedSkills: string[];
  gapSkills: string[];
} {
  const matchedKw = data.keywords.filter((k) => k.matched);
  const gapKw = data.keywords.filter((k) => !k.matched);
  const reasons: string[] = [];

  if (data.summaryNote?.trim()) {
    reasons.push(data.summaryNote.trim());
  }
  if (data.yoeMatch && data.yoeCandidate) {
    reasons.push(`Your ${data.yoeCandidate} meets the ${data.yoeRequired} requirement.`);
  } else if (data.yoeRequired && data.yoeCandidate) {
    reasons.push(`Experience: role asks for ${data.yoeRequired}; your resume shows ${data.yoeCandidate}.`);
  }
  if (data.industryMatch && data.industries.length) {
    reasons.push(`Industry overlap with ${data.industries.slice(0, 3).join(", ")}.`);
  } else if (data.industries.length) {
    reasons.push(`Limited industry overlap with ${data.industries.slice(0, 3).join(", ")}.`);
  }
  if (data.keywords.length) {
    reasons.push(`${matchedKw.length} of ${data.keywords.length} key job terms appear on your resume.`);
  }
  if (data.jobTitleMatch === false && data.jobTitle && data.resumeTitle) {
    reasons.push(`Title: posting is "${data.jobTitle}" — your recent title is "${data.resumeTitle}".`);
  }

  return {
    matchScore: Math.round(data.score * 10),
    matchLabel: data.scoreLabel,
    matchReasons: reasons.filter(Boolean).slice(0, 4),
    matchedSkills: matchedKw.map((k) => k.text).slice(0, 8),
    gapSkills: gapKw.map((k) => k.text).slice(0, 4),
  };
}

export type MatchScoreBand = "excellent" | "strong" | "good" | "fair" | "poor";

export function scoreBand(score: number): MatchScoreBand {
  if (score >= 9) return "excellent";
  if (score >= 8) return "strong";
  if (score >= 6) return "good";
  if (score >= 4) return "fair";
  return "poor";
}

export function scoreColor(score: number): string {
  const band = scoreBand(score);
  if (band === "excellent" || band === "strong") return "#15803D";
  if (band === "good") return "#CA8A04";
  if (band === "fair") return "#EA580C";
  return "#DC2626";
}

export function scoreLabel(score: number): string {
  const band = scoreBand(score);
  if (band === "excellent") return "Excellent";
  if (band === "strong") return "Strong";
  if (band === "good") return "Good";
  if (band === "fair") return "Fair";
  return "Low";
}

export function percentColor(pct: number): string {
  if (pct >= 75) return "#16A34A";
  if (pct >= 55) return "#CA8A04";
  if (pct >= 40) return "#EA580C";
  return "#DC2626";
}

export function percentBg(pct: number): string {
  if (pct >= 75) return "rgba(34,197,94,0.18)";
  if (pct >= 55) return "rgba(234,179,8,0.18)";
  if (pct >= 40) return "rgba(249,115,22,0.16)";
  return "rgba(239,68,68,0.14)";
}

export type RowStatus = "ok" | "fail" | "warn" | "neutral";

export function rowStatusStyles(status: RowStatus) {
  const icon =
    status === "ok" ? "✓" : status === "fail" ? "✗" : status === "warn" ? "!" : "–";
  const iconColor =
    status === "ok" ? "#15803D"
    : status === "fail" ? "#DC2626"
    : status === "warn" ? "#CA8A04"
    : color.muted;
  const iconBg =
    status === "ok" ? "rgba(34,197,94,0.16)"
    : status === "fail" ? "rgba(239,68,68,0.14)"
    : status === "warn" ? "rgba(234,179,8,0.16)"
    : "rgba(0,0,0,0.05)";
  const rowBg =
    status === "ok" ? "rgba(34,197,94,0.06)"
    : status === "fail" ? "rgba(239,68,68,0.05)"
    : status === "warn" ? "rgba(249,115,22,0.05)"
    : "transparent";
  const leftBorderColor =
    status === "ok" ? "#16A34A"
    : status === "fail" ? "#EF4444"
    : status === "warn" ? "#F97316"
    : "transparent";
  return { icon, iconColor, iconBg, rowBg, leftBorderColor };
}

export function BigScoreGauge({ score }: { score: number }) {
  const c = scoreColor(score);
  const label = scoreLabel(score);
  const r = 58;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 10, 1);
  const arcLen = circ * 0.5 * pct;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ position: "relative", width: 140, height: 76, overflow: "hidden" }}>
        <svg
          width="140"
          height="140"
          viewBox="0 0 130 130"
          style={{ position: "absolute", top: 0, left: 0, transform: "rotate(180deg)" }}
        >
          <defs>
            <linearGradient id="kimchi-gauge-bg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FCA5A5" stopOpacity="0.45" />
              <stop offset="35%" stopColor="#FCD34D" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#86EFAC" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#4ADE80" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <circle
            cx="65" cy="65" r={r}
            stroke="url(#kimchi-gauge-bg)" strokeWidth="14" fill="none"
            strokeDasharray={`${circ * 0.5} ${circ * 0.5}`}
            strokeLinecap="round"
          />
          <circle
            cx="65" cy="65" r={r}
            stroke={c} strokeWidth="14" fill="none"
            strokeDasharray={`${arcLen} ${circ - arcLen}`}
            strokeLinecap="round"
          />
        </svg>
        <div style={{ position: "absolute", bottom: 2, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontFamily: mono, fontSize: 32, fontWeight: 700, color: c, lineHeight: 1 }}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, color: c, letterSpacing: "0.4px" }}>
        {label}
      </span>
    </div>
  );
}

export function SmallScoreGauge({ score }: { score: number }) {
  const c = scoreColor(score);
  const label = scoreLabel(score);
  const r = 32;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 10, 1);
  const arcLen = circ * 0.5 * pct;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ position: "relative", width: 76, height: 40, overflow: "hidden" }}>
        <svg
          width="76"
          height="76"
          viewBox="0 0 76 76"
          style={{ position: "absolute", top: 0, left: 0, transform: "rotate(180deg)" }}
        >
          <circle cx="38" cy="38" r={r} stroke="rgba(0,0,0,0.07)" strokeWidth="8" fill="none"
            strokeDasharray={`${circ * 0.5} ${circ * 0.5}`} strokeLinecap="round" />
          <circle cx="38" cy="38" r={r} stroke={c} strokeWidth="8" fill="none"
            strokeDasharray={`${arcLen} ${circ - arcLen}`} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", bottom: 1, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: c, lineHeight: 1 }}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: c, letterSpacing: "0.3px" }}>
        {label.toUpperCase()}
      </span>
    </div>
  );
}

export function MatchBreakdownBar({ label, pct }: { label: string; pct: number }) {
  const barColor = percentColor(pct);
  const bg = percentBg(pct);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: sans, fontSize: 13, color: "#5C534A" }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: barColor }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: "var(--scout-radius)", background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "var(--scout-radius)", boxShadow: `0 0 0 1px ${bg}` }} />
      </div>
    </div>
  );
}

export type ResumeAssetOption = { id: string; name: string; isPrimary: boolean };

export function ResumeSelectDropdown({
  assets,
  value,
  onChange,
  compact,
}: {
  assets: ResumeAssetOption[];
  value: string | null;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  if (!assets.length) return null;
  const selected = assets.find((a) => a.id === value) ?? assets[0];

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
      {!compact && (
        <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Resume
        </span>
      )}
      <select
        value={selected.id}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: sans,
          fontSize: compact ? 12 : 13,
          fontWeight: 600,
          color: color.forest,
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.28)",
          borderRadius: "var(--scout-radius)",
          padding: compact ? "4px 8px" : "6px 10px",
          maxWidth: compact ? 140 : 200,
          cursor: "pointer",
          outline: "none",
        }}
        title={selected.name}
      >
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.name.replace(/\.[^.]+$/, "").slice(0, 42)}
            {asset.isPrimary ? " ★" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MatchKeywordTag({ text, matched }: { text: string; matched: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 9px",
        borderRadius: "var(--scout-radius)",
        fontFamily: sans,
        fontSize: 13,
        fontWeight: 600,
        background: matched ? "rgba(34,197,94,0.14)" : "rgba(254,226,226,0.9)",
        color: matched ? "#166534" : "#991B1B",
        border: `1px solid ${matched ? "rgba(34,197,94,0.35)" : "rgba(248,113,113,0.45)"}`,
      }}
    >
      <span style={{ fontSize: 12 }}>{matched ? "👍" : "✗"}</span>
      {text}
    </span>
  );
}

export function IndustryTag({ label, matched }: { label: string; matched: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: "var(--scout-radius)",
        fontFamily: sans,
        fontSize: 13,
        fontWeight: 500,
        background: matched ? "rgba(34,197,94,0.14)" : "rgba(0,0,0,0.04)",
        color: matched ? "#166534" : "#52493F",
        border: `1px solid ${matched ? "rgba(34,197,94,0.3)" : "rgba(0,0,0,0.08)"}`,
      }}
    >
      {matched && <span style={{ fontSize: 11 }}>👍</span>}
      {label}
    </span>
  );
}

export const MATCH_ROW_GRID_SPLIT = "148px 30px 1fr 1fr";
export const MATCH_ROW_GRID_FULL = "148px 30px 1fr";

export function MatchComparisonRow({
  label,
  left,
  right,
  status,
  layout = "split",
}: {
  label: string;
  left: React.ReactNode;
  right?: React.ReactNode;
  status: RowStatus;
  /** split = job | resume columns; full = single content span */
  layout?: "split" | "full";
}) {
  const s = rowStatusStyles(status);
  const isFull = layout === "full";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isFull ? MATCH_ROW_GRID_FULL : MATCH_ROW_GRID_SPLIT,
        gap: 12,
        alignItems: "start",
        padding: "13px 16px",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        background: s.rowBg,
        borderLeft: status !== "neutral" ? `3px solid ${s.leftBorderColor}` : "3px solid transparent",
      }}
    >
      <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: "#52493F" }}>{label}</span>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: s.iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: sans,
          fontSize: 13,
          fontWeight: 800,
          color: s.iconColor,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {s.icon}
      </div>
      {isFull ? (
        <div style={{ fontFamily: sans, fontSize: 14, color: "#1A1A1A", lineHeight: 1.55 }}>{left}</div>
      ) : (
        <>
          <div style={{ fontFamily: sans, fontSize: 14, color: "#1A1A1A", lineHeight: 1.55 }}>{left}</div>
          <div style={{ fontFamily: sans, fontSize: 14, color: "#52493F", lineHeight: 1.55 }}>{right}</div>
        </>
      )}
    </div>
  );
}
