"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fontSans, color, surface, border as B } from "@/lib/typography";
import { notifyCreditsChanged } from "@/lib/credits";
import { friendlyResumeError } from "@/lib/user-facing-copy";
import { getActingUserScope } from "@/lib/client-session";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoreExplainerLabel, ScoreExplainerPopover } from "./score-explainer-popover";
import {
  MatchBreakdownBar,
  ResumeSelectDropdown,
  SmallScoreGauge,
  scoreColor,
  scoreLabel,
  type MatchData,
  type ResumeAssetOption,
} from "./job-match-ui";

const sans = fontSans;
const line = B.line;

function matchCacheKey(jobKey: string, assetId: string) {
  return `kimchi-match:${getActingUserScope()}:${jobKey}:${assetId}`;
}

export function JobMatchScorePanel({
  vectorFit,
  jobTitle,
  company,
  description,
  jobId,
  onRunFullMatch,
  onMatchChange,
  onAnalyzeControlsChange,
  fullWidth,
}: {
  vectorFit: number;
  jobTitle: string;
  company: string;
  description: string;
  jobId?: string | null;
  onRunFullMatch?: () => void;
  onMatchChange?: (data: MatchData | null, assetId: string | null, loading: boolean, resumeName: string | null) => void;
  onAnalyzeControlsChange?: (controls: {
    run: () => void;
    canAnalyze: boolean;
    loading: boolean;
    hasAiMatch: boolean;
    selectedId: string | null;
  }) => void;
  fullWidth?: boolean;
}) {
  const { withClientScope } = useWorkspace();
  const [assets, setAssets] = useState<ResumeAssetOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiMatch, setAiMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jobKey = jobId ?? `${company}:${jobTitle}`;
  const canAnalyze = description.trim().length >= 40;

  useEffect(() => {
    fetch(withClientScope("/api/assets"))
      .then((r) => r.json())
      .then((rows: Array<{ id: string; name: string; isPrimary: boolean; type?: string }>) => {
        if (!Array.isArray(rows)) return;
        const resumes = rows.filter((a) => a.type === "RESUME").map((a) => ({ id: a.id, name: a.name, isPrimary: a.isPrimary }));
        setAssets(resumes);
        if (resumes.length) {
          setSelectedId((prev) => prev ?? resumes.find((r) => r.isPrimary)?.id ?? resumes[0].id);
        }
      })
      .catch(() => {});
  }, [withClientScope]);

  const fetchMatch = useCallback(
    async (assetId: string) => {
      if (!canAnalyze) return;
      setLoading(true);
      setError(null);
      try {
        const body = jobId
          ? { jobId, jobTitle, company, description, assetId }
          : { jobTitle, company, description, assetId };
        const res = await fetch(withClientScope("/api/ai/job-match"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as MatchData & { error?: string };
        if (res.status === 402) {
          notifyCreditsChanged();
          setError(data.error ?? "Out of credits for this month");
          setAiMatch(null);
          return;
        }
        if (!res.ok) {
          setError(data.error ?? "Could not analyze match");
          setAiMatch(null);
          return;
        }
        setAiMatch(data);
        notifyCreditsChanged();
        try {
          sessionStorage.setItem(matchCacheKey(jobKey, assetId), JSON.stringify(data));
        } catch {
          /* ignore */
        }
      } catch {
        setError("Could not analyze match");
        setAiMatch(null);
      } finally {
        setLoading(false);
      }
    },
    [canAnalyze, company, description, jobId, jobKey, jobTitle, withClientScope],
  );

  // On job or resume selection change: restore session cache only — never auto-call AI on drawer open.
  useEffect(() => {
    if (!selectedId || !canAnalyze) {
      setAiMatch(null);
      setError(null);
      return;
    }
    try {
      const cached = sessionStorage.getItem(matchCacheKey(jobKey, selectedId));
      if (cached) {
        setAiMatch(JSON.parse(cached) as MatchData);
        setError(null);
        return;
      }
    } catch {
      /* ignore */
    }
    setAiMatch(null);
    setError(null);
  }, [jobKey, selectedId, canAnalyze]);

  const handleResumeChange = useCallback(
    (assetId: string) => {
      setSelectedId(assetId);
    },
    [],
  );

  const handleAnalyze = useCallback(() => {
    if (selectedId) void fetchMatch(selectedId);
  }, [fetchMatch, selectedId]);

  const selectedResumeName =
    assets.find((a) => a.id === selectedId)?.name.replace(/\.[^.]+$/, "") ?? null;

  useEffect(() => {
    onMatchChange?.(aiMatch, selectedId, loading, selectedResumeName);
  }, [aiMatch, selectedId, loading, selectedResumeName, onMatchChange]);

  useEffect(() => {
    onAnalyzeControlsChange?.({
      run: handleAnalyze,
      canAnalyze,
      loading,
      hasAiMatch: Boolean(aiMatch),
      selectedId,
    });
  }, [handleAnalyze, canAnalyze, loading, aiMatch, selectedId, onAnalyzeControlsChange]);

  const displayScore = aiMatch?.score ?? (vectorFit > 0 ? vectorFit / 10 : 0);
  const headlineColor = displayScore > 0 ? scoreColor(displayScore) : color.muted;
  const label = aiMatch?.scoreLabel ?? (vectorFit > 0 ? scoreLabel(vectorFit / 10).toUpperCase() : null);

  const breakdown = useMemo(() => {
    if (aiMatch) {
      const matchedKw = aiMatch.keywords.filter((k) => k.matched).length;
      const kwTotal = Math.max(aiMatch.keywords.length, 1);
      const kwPct = Math.round((matchedKw / kwTotal) * 100);
      return {
        experience: aiMatch.yoeMatch ? 88 : 52,
        skills: kwPct,
        industry: aiMatch.industryMatch ? 84 : 48,
      };
    }
    if (vectorFit > 0) {
      return {
        experience: vectorFit,
        skills: Math.max(0, Math.min(100, vectorFit - 4)),
        industry: Math.max(0, Math.min(100, vectorFit - 8)),
      };
    }
    return null;
  }, [aiMatch, vectorFit]);

  if (displayScore <= 0 && !onRunFullMatch) {
    return null;
  }

  if (displayScore <= 0 && onRunFullMatch) {
    return (
      <div style={{ background: surface.card, borderRadius: "var(--scout-radius)", padding: "20px 22px", minWidth: fullWidth ? undefined : 220, width: fullWidth ? "100%" : undefined, border: line, boxSizing: "border-box" }}>
        <p style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: "#5C534A", marginBottom: 10 }}>
          <ScoreExplainerLabel variant="job-match">Match score</ScoreExplainerLabel>
        </p>
        <p style={{ fontFamily: sans, fontSize: 14, color: "#8A8278", lineHeight: 1.5, marginBottom: 14 }}>See how well your resume fits this role.</p>
        <button
          type="button"
          onClick={onRunFullMatch}
          style={{ width: "100%", padding: "11px 14px", minHeight: fullWidth ? 44 : undefined, background: color.forest, color: color.gold, border: "none", borderRadius: "var(--scout-radius)", fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          Analyze match
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: surface.card, borderRadius: "var(--scout-radius)", padding: "20px 22px", minWidth: fullWidth ? undefined : 240, width: fullWidth ? "100%" : undefined, border: line, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: headlineColor, letterSpacing: "0.5px", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
            {label ? `${label} MATCH` : "MATCH"}
            <ScoreExplainerPopover variant={aiMatch ? "job-match" : "vector-match"} align="right" />
          </p>
          <p style={{ fontFamily: sans, fontSize: 13, color: "#8A8278", margin: 0 }}>
            {aiMatch ? "AI analysis for selected resume" : "Based on your profile"}
          </p>
          {assets.length > 0 && selectedId && (
            <div style={{ marginTop: 10 }}>
              <ResumeSelectDropdown assets={assets} value={selectedId} onChange={handleResumeChange} />
            </div>
          )}
        </div>
        <div style={{ opacity: loading ? 0.5 : 1 }}>
          <SmallScoreGauge score={displayScore} />
        </div>
      </div>

      {loading && (
        <p style={{ fontFamily: sans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>Analyzing resume…</p>
      )}
      {error && (() => {
        const friendly = friendlyResumeError(error);
        return (
          <div style={{ margin: "0 0 10px" }}>
            <p style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: "#1A1A1A", margin: "0 0 4px" }}>{friendly.headline}</p>
            <p style={{ fontFamily: sans, fontSize: 13, color: "#52493F", margin: 0, lineHeight: 1.5 }}>{friendly.body}</p>
          </div>
        );
      })()}

      {breakdown && (
        <>
          <MatchBreakdownBar label="Experience Level" pct={breakdown.experience} />
          <MatchBreakdownBar label="Skills" pct={breakdown.skills} />
          <MatchBreakdownBar label="Industry Exp." pct={breakdown.industry} />
        </>
      )}

      {onRunFullMatch && (
        <button
          type="button"
          onClick={onRunFullMatch}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "10px 14px",
            background: "rgba(34,197,94,0.08)",
            color: color.forest,
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: "var(--scout-radius)",
            fontFamily: sans,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          See full comparison →
        </button>
      )}
    </div>
  );
}
