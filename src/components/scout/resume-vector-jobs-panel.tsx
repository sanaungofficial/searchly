"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";
import { cachedJobToMeta } from "@/lib/cached-job";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

type SearchResponse = {
  jobs?: VectorMatchedJob[];
  totalCount?: number;
  error?: string;
  needsResume?: boolean;
  reEmbedded?: boolean;
};

function scoreColor(score: number): string {
  if (score >= 75) return "#2A6B4A";
  if (score >= 55) return "#6B5A2A";
  return "#8A6B4A";
}

export function ResumeVectorJobsPanel({
  onOpenJob,
  onAddToPipeline,
}: {
  onOpenJob?: (companyName: string, job: VectorMatchedJob) => void;
  onAddToPipeline?: (companyName: string, job: VectorMatchedJob) => Promise<void>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<VectorMatchedJob[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs/vector-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      });
      const data = (await res.json()) as SearchResponse;
      if (!res.ok) {
        setError(data.error ?? "Could not search for matching jobs.");
        setJobs([]);
        setTotalCount(0);
      } else {
        setJobs(data.jobs ?? []);
        setTotalCount(data.totalCount ?? data.jobs?.length ?? 0);
      }
      setHasSearched(true);
    } catch {
      setError("Network error — try again.");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAdd = async (job: VectorMatchedJob) => {
    if (!onAddToPipeline) return;
    const key = job.hirebaseId ?? job.url ?? job.title;
    setAddingId(key);
    try {
      await onAddToPipeline(job.companyName, job);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 28px 40px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <ScoutBox padding={24} style={{ marginBottom: 20 }}>
          <ScoutDisplayTitle size={26} style={{ marginBottom: 8 }}>
            Resume-matched jobs
          </ScoutDisplayTitle>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: "0 0 16px" }}>
            Kimchi embeds your resume with Hirebase, then searches their job index semantically — not just by keywords.
            Each result includes why it fits your background.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <ScoutPrimaryBtn onClick={runSearch} disabled={loading}>
              {loading ? "Searching…" : hasSearched ? "↻ Refresh matches" : "Find matching jobs"}
            </ScoutPrimaryBtn>
            <ScoutSecondaryBtn onClick={() => router.push("/profile")}>
              Upload / update resume
            </ScoutSecondaryBtn>
          </div>
          {error && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", marginTop: 14, lineHeight: 1.45 }}>
              {error}
            </p>
          )}
        </ScoutBox>

        {!hasSearched && !loading && (
          <ScoutBox style={{ padding: 48, textAlign: "center", borderStyle: "dashed" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>
              Upload a resume in Profile, then click Find matching jobs.
            </p>
          </ScoutBox>
        )}

        {hasSearched && !loading && jobs.length === 0 && !error && (
          <ScoutBox style={{ padding: 48, textAlign: "center" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>
              No matching jobs found. Try updating target roles in Profile or broadening your search later.
            </p>
          </ScoutBox>
        )}

        {jobs.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <ScoutLabel>{totalCount > jobs.length ? `${jobs.length} of ${totalCount} matches` : `${jobs.length} matches`}</ScoutLabel>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {jobs.map((job) => {
                const key = job.hirebaseId ?? job.url ?? `${job.companyName}-${job.title}`;
                const expanded = expandedId === key;
                return (
                  <ScoutBox key={key} padding={18}>
                    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                      <CompanyLogo name={job.companyName} website={job.url} size={44} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{job.title}</p>
                            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                              {job.companyName}
                              {job.location ? ` · ${job.location}` : ""}
                            </p>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div
                              style={{
                                fontFamily: fontMono,
                                fontSize: 22,
                                fontWeight: 700,
                                color: scoreColor(job.matchScore),
                                lineHeight: 1,
                              }}
                            >
                              {job.matchScore}
                            </div>
                            <div style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, marginTop: 4 }}>
                              {job.matchLabel}
                            </div>
                          </div>
                        </div>

                        <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontFamily: fontSans, fontSize: T.caption, color: color.ink, lineHeight: 1.5 }}>
                          {(expanded ? job.matchReasons : job.matchReasons.slice(0, 2)).map((reason) => (
                            <li key={reason} style={{ marginBottom: 4 }}>{reason}</li>
                          ))}
                        </ul>

                        {job.matchReasons.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : key)}
                            style={{
                              marginTop: 8,
                              background: "none",
                              border: "none",
                              padding: 0,
                              fontFamily: fontSans,
                              fontSize: T.label,
                              color: color.forest,
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            {expanded ? "Show less" : `+${job.matchReasons.length - 2} more reasons`}
                          </button>
                        )}

                        {(job.matchedSkills.length > 0 || job.gapSkills.length > 0) && expanded && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                            {job.matchedSkills.map((skill) => (
                              <span
                                key={`m-${skill}`}
                                style={{
                                  padding: "3px 8px",
                                  background: "rgba(74,139,106,0.12)",
                                  fontFamily: fontSans,
                                  fontSize: T.label,
                                  color: "#2A4A3A",
                                }}
                              >
                                {skill}
                              </span>
                            ))}
                            {job.gapSkills.map((skill) => (
                              <span
                                key={`g-${skill}`}
                                style={{
                                  padding: "3px 8px",
                                  background: "rgba(196,168,106,0.15)",
                                  fontFamily: fontSans,
                                  fontSize: T.label,
                                  color: "#6B5A2A",
                                }}
                              >
                                Gap: {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                          {onOpenJob && (
                            <ScoutSecondaryBtn onClick={() => onOpenJob(job.companyName, job)}>
                              View details
                            </ScoutSecondaryBtn>
                          )}
                          {onAddToPipeline && (
                            <ScoutPrimaryBtn onClick={() => handleAdd(job)} disabled={addingId === key}>
                              {addingId === key ? "Adding…" : "Add to pipeline"}
                            </ScoutPrimaryBtn>
                          )}
                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                alignSelf: "center",
                                fontFamily: fontSans,
                                fontSize: T.caption,
                                color: color.muted,
                                textDecoration: "underline",
                              }}
                            >
                              Open posting ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </ScoutBox>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}