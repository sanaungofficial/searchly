"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NetworkJobListing } from "@/lib/network-job-display";
import { SEED_NETWORK_JOBS, previewPlainText } from "@/lib/network-job-display";
import {
  EMPTY_NETWORK_JOB_FILTERS,
  buildNetworkJobFilterOptions,
  filterNetworkJobs,
} from "@/lib/network-job-filters";
import { NetworkJobFilterPanel } from "./network-job-filter-panel";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

interface PipelineNetworkSectionProps {
  onOpenJob: (job: NetworkJobListing) => void;
  onSaveJob?: (job: NetworkJobListing) => Promise<void>;
}

function NetworkJobCard({
  job,
  onOpen,
  onSave,
  saving,
}: {
  job: NetworkJobListing;
  onOpen: () => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  const company = job.companyName ?? job.recruiter?.agencyName ?? "Confidential employer";
  const summary = previewPlainText(job.description);
  const shareLabel = job.sharedAt
    ? job.sharedAtRelative
      ? `Shared ${job.sharedAtLabel} · ${job.sharedAtRelative}`
      : `Shared ${job.sharedAtLabel}`
    : null;

  return (
    <ScoutBox stack padding={18} style={{ borderTop: "3px solid rgba(196,168,106,0.55)" }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        style={{ display: "flex", gap: 16, alignItems: "flex-start", cursor: "pointer" }}
      >
        <CompanyLogo name={company} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <span
              style={{
                padding: "2px 8px",
                background: "rgba(196,168,106,0.15)",
                border: "1px solid rgba(196,168,106,0.35)",
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#6B5A2A",
              }}
            >
              Recruiter network
            </span>
            {job.networkStatusLabel && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.forest }}>
                {job.networkStatusLabel}
              </span>
            )}
            {job.networkId && (
              <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight }}>{job.networkId}</span>
            )}
          </div>

          <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{job.positionTitle}</p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 4px" }}>
            {company}
            {job.location ? ` · ${job.location}` : ""}
          </p>
          {shareLabel && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "0 0 8px" }}>{shareLabel}</p>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: summary ? 10 : 0 }}>
            {job.industries.map((industry) => (
              <span key={industry} style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {industry}
              </span>
            ))}
            {job.jobType && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {job.jobType}
              </span>
            )}
            {job.remoteOption && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {job.remoteOption}
              </span>
            )}
            {job.salary && (
              <span style={{ padding: "2px 8px", border: "1px solid rgba(26,58,47,0.22)", background: "rgba(26,58,47,0.05)", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
                {job.salary}
              </span>
            )}
            {job.fee && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                Fee: {job.fee}
              </span>
            )}
          </div>

          {summary && (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.55, margin: 0 }}>
              {summary}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, paddingLeft: 60, flexWrap: "wrap" }}>
        {onSave && (
          <ScoutPrimaryBtn onClick={(e) => { e.stopPropagation(); onSave(); }} disabled={saving}>
            {saving ? "Saving…" : "Save to pipeline"}
          </ScoutPrimaryBtn>
        )}
        {job.topEchelonUrl && (
          <a
            href={job.topEchelonUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ alignSelf: "center", fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}
          >
            Top Echelon ↗
          </a>
        )}
      </div>
    </ScoutBox>
  );
}

export function PipelineNetworkSection({ onOpenJob, onSaveJob }: PipelineNetworkSectionProps) {
  const [jobs, setJobs] = useState<NetworkJobListing[]>(SEED_NETWORK_JOBS);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filters, setFilters] = useState(EMPTY_NETWORK_JOB_FILTERS);
  const [wideLayout, setWideLayout] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/network-jobs");
      const data = (await res.json()) as { jobs?: NetworkJobListing[] };
      if (res.ok && Array.isArray(data.jobs) && data.jobs.length) {
        setJobs(data.jobs);
      }
    } catch {
      setJobs(SEED_NETWORK_JOBS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 960px)");
    const update = () => setWideLayout(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const filterOptions = useMemo(() => buildNetworkJobFilterOptions(jobs), [jobs]);
  const visibleJobs = useMemo(() => filterNetworkJobs(jobs, filters), [jobs, filters]);

  return (
    <div style={{ padding: "32px 36px 48px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: "#C4A86A", display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>Premium recruiter network · internal</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={36} style={{ marginBottom: 10 }}>
          In-network & second-tier roles
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
          Shared privately through Top Echelon Big Biller — not public job boards. Filter by location, industry, status, and compensation. Open a role for the full pipeline drawer with match tools, recruiter profile, and TE link.
        </p>
      </div>

      {loading ? (
        <ScoutBox style={{ padding: 48, textAlign: "center" }}>
          <p style={{ color: color.mutedLight, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>Loading network roles…</p>
        </ScoutBox>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: wideLayout ? "minmax(0, 1fr) 280px" : "1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div>
            {!wideLayout && (
              <NetworkJobFilterPanel
                filters={filters}
                options={filterOptions}
                totalCount={jobs.length}
                filteredCount={visibleJobs.length}
                onChange={setFilters}
              />
            )}

            {visibleJobs.length === 0 ? (
              <ScoutBox style={{ padding: 48, textAlign: "center" }}>
                <p style={{ color: color.muted, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
                  No roles match these filters. Try clearing a filter or broadening your search.
                </p>
              </ScoutBox>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visibleJobs.map((job) => (
                  <NetworkJobCard
                    key={job.id}
                    job={job}
                    onOpen={() => onOpenJob(job)}
                    onSave={onSaveJob ? () => {
                      setSavingId(job.id);
                      onSaveJob(job).finally(() => setSavingId(null));
                    } : undefined}
                    saving={savingId === job.id}
                  />
                ))}
              </div>
            )}
          </div>

          {wideLayout && (
            <NetworkJobFilterPanel
              filters={filters}
              options={filterOptions}
              totalCount={jobs.length}
              filteredCount={visibleJobs.length}
              onChange={setFilters}
              wideLayout
            />
          )}
        </div>
      )}
    </div>
  );
}
