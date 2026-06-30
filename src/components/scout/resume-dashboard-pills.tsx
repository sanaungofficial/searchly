"use client";

import { RefreshCw } from "lucide-react";
import { JR } from "./profile-resume-editor-panels";
import { RP } from "@/lib/resume-page-tokens";

export function ResumeDashboardPills({
  urgentCount = 0,
  criticalCount = 0,
  optionalCount = 0,
  issueCount,
  suggestionCount,
  qualityScore,
  jobMatchScore,
  hasJobDescription,
  onIssuesClick,
  onSuggestionsClick,
  onScoreClick,
  onReAnalyze,
  reAnalyzing,
  analysisCachedAt,
}: {
  urgentCount?: number;
  criticalCount?: number;
  optionalCount?: number;
  issueCount?: number;
  suggestionCount?: number;
  qualityScore: number;
  jobMatchScore?: number | null;
  hasJobDescription?: boolean;
  onIssuesClick?: () => void;
  onSuggestionsClick?: () => void;
  onScoreClick?: () => void;
  onReAnalyze: () => void;
  reAnalyzing?: boolean;
  analysisCachedAt?: string | null;
}) {
  const showJobMatch = !!hasJobDescription && jobMatchScore != null;
  const displayScore = showJobMatch ? jobMatchScore : qualityScore;
  const scoreSuffix = showJobMatch ? "/10" : "/100";
  const resolvedUrgent = urgentCount || issueCount || 0;
  const resolvedCritical = criticalCount || 0;
  const resolvedOptional = optionalCount || suggestionCount || 0;

  const statCard = (
    count: number,
    label: string,
    color: string,
    bg: string,
    onClick?: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 88,
        padding: "10px 14px",
        background: bg,
        border: `1px solid ${RP.border}`,
        borderRadius: RP.ctaSecondaryRadius,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{count}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 0.4, marginTop: 4, textTransform: "uppercase" }}>
        {label}
      </span>
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
        padding: "14px 16px",
        background: RP.scoreBannerBg,
        borderRadius: RP.ctaSecondaryRadius,
        border: `1px solid ${RP.border}`,
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {statCard(resolvedUrgent, "Urgent Fix", RP.urgent, RP.urgentBg, onIssuesClick)}
        {statCard(resolvedCritical, "Critical Fix", RP.critical, RP.criticalBg, onIssuesClick)}
        {statCard(resolvedOptional, "Optional Fix", RP.optional, RP.optionalBg, onSuggestionsClick)}
      </div>
      <button
        type="button"
        onClick={onScoreClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          borderRadius: 999,
          border: `1px solid ${RP.mintBorder}`,
          background: RP.mintTint,
          fontSize: 12,
          fontWeight: 700,
          color: RP.text,
          cursor: "pointer",
        }}
      >
        {typeof displayScore === "number" ? (showJobMatch ? displayScore.toFixed(1) : displayScore) : displayScore}
        {scoreSuffix}
      </button>
      <button
        type="button"
        onClick={onReAnalyze}
        disabled={reAnalyzing}
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          background: RP.text,
          color: "#FFFFFF",
          border: "none",
          borderRadius: RP.ctaPrimaryRadius,
          fontSize: 12,
          fontWeight: 700,
          cursor: reAnalyzing ? "wait" : "pointer",
        }}
      >
        <RefreshCw size={13} style={reAnalyzing ? { animation: "spin 1s linear infinite" } : undefined} />
        {reAnalyzing ? "Analyzing…" : "Re-Analyze"}
        {analysisCachedAt && !reAnalyzing && (
          <span style={{ fontWeight: 500, opacity: 0.75, marginLeft: 4 }}>Last updated</span>
        )}
      </button>
    </div>
  );
}

export function SectionIssueBadge({ count, onFix }: { count: number; onFix: () => void }) {
  if (count <= 0) {
    return (
      <button
        type="button"
        onClick={onFix}
        style={{
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 700,
          borderRadius: RP.ctaSecondaryRadius,
          border: "none",
          background: RP.mint,
          color: RP.text,
          cursor: "pointer",
        }}
      >
        FIX
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 700,
          borderRadius: RP.ctaSecondaryRadius,
          background: count >= 2 ? RP.criticalBg : RP.urgentBg,
          color: count >= 2 ? RP.critical : RP.urgent,
        }}
      >
        {count} {count === 1 ? "Critical" : "Issues"}
      </span>
      <button
        type="button"
        onClick={onFix}
        style={{
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 700,
          borderRadius: RP.ctaSecondaryRadius,
          border: "none",
          background: RP.mint,
          color: RP.text,
          cursor: "pointer",
        }}
      >
        FIX
      </button>
    </div>
  );
}
