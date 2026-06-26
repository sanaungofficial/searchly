"use client";

import { RefreshCw } from "lucide-react";
import { JR } from "./profile-resume-editor-panels";

export function ResumeDashboardPills({
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
}: {
  issueCount: number;
  suggestionCount: number;
  qualityScore: number;
  jobMatchScore?: number | null;
  hasJobDescription?: boolean;
  onIssuesClick?: () => void;
  onSuggestionsClick?: () => void;
  onScoreClick?: () => void;
  onReAnalyze: () => void;
  reAnalyzing?: boolean;
}) {
  const showJobMatch = !!hasJobDescription && jobMatchScore != null;
  const displayScore = showJobMatch ? jobMatchScore : qualityScore;
  const scoreLabel = showJobMatch ? "Job match" : "Quality score";
  const scoreSuffix = showJobMatch ? "/10" : "/100";

  const pillBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: "var(--scout-radius)",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
      <button
        type="button"
        onClick={onIssuesClick}
        style={{ ...pillBase, background: JR.urgentBg, color: JR.urgent }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: JR.urgent }} />
        {issueCount} Issue{issueCount === 1 ? "" : "s"}
      </button>
      <button
        type="button"
        onClick={onSuggestionsClick}
        style={{ ...pillBase, background: JR.criticalBg, color: "#92400E" }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EAB308" }} />
        {suggestionCount} Suggestion{suggestionCount === 1 ? "" : "s"}
      </button>
      <button
        type="button"
        onClick={onScoreClick}
        style={{ ...pillBase, background: "rgba(59,130,246,0.1)", color: "#1D4ED8" }}
      >
        {typeof displayScore === "number" ? (showJobMatch ? displayScore.toFixed(1) : displayScore) : displayScore}
        {scoreSuffix} {scoreLabel}
      </button>
      <button
        type="button"
        onClick={onReAnalyze}
        disabled={reAnalyzing}
        style={{
          ...pillBase,
          background: JR.panel,
          color: JR.text,
          border: `1px solid ${JR.border}`,
          cursor: reAnalyzing ? "wait" : "pointer",
        }}
      >
        <RefreshCw size={12} style={reAnalyzing ? { animation: "spin 1s linear infinite" } : undefined} />
        {reAnalyzing ? "Analyzing…" : "Re-analyze"}
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
          borderRadius: "var(--scout-radius)",
          border: "none",
          background: JR.green,
          color: JR.gold,
          cursor: "pointer",
        }}
      >
        Fix
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
          borderRadius: "var(--scout-radius)",
          background: JR.urgentBg,
          color: JR.urgent,
        }}
      >
        {count} issue{count === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        onClick={onFix}
        style={{
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 700,
          borderRadius: "var(--scout-radius)",
          border: "none",
          background: JR.green,
          color: JR.gold,
          cursor: "pointer",
        }}
      >
        Fix
      </button>
    </div>
  );
}
