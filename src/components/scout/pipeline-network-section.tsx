"use client";

import { useState } from "react";
import type { NetworkJobListing } from "@/lib/network-job";
import {
  SEED_NETWORK_JOBS,
  cardAgencyName,
  cardCompensationLabel,
  cardDescriptionPreview,
  cardLocationParts,
  cardNetworkId,
  cardRecruiterLabel,
  cardSharedAt,
  cardTitle,
} from "@/lib/network-job";
import { rawFieldString } from "@/lib/network-job-raw-display";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

interface PipelineNetworkSectionProps {
  jobs?: NetworkJobListing[];
  onOpenJob: (job: NetworkJobListing) => void;
}

function NetworkJobCard({ job, onOpen }: { job: NetworkJobListing; onOpen: () => void }) {
  const title = cardTitle(job);
  const agency = cardAgencyName(job);
  const networkId = cardNetworkId(job);
  const sharedAt = cardSharedAt(job);
  const recruiter = cardRecruiterLabel(job);
  const locationParts = cardLocationParts(job);
  const compensation = cardCompensationLabel(job);
  const jobType = rawFieldString(job.raw, "job_type", "jobType");
  const remoteOption = rawFieldString(job.raw, "remote_option", "remoteOption");
  const networkStatus = rawFieldString(job.raw, "network_status", "networkStatus");
  const summary = cardDescriptionPreview(job);

  return (
    <ScoutBox
      stack
      padding={18}
      style={{
        borderTop: "3px solid rgba(196,168,106,0.55)",
      }}
    >
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
        style={{ display: "flex", alignItems: "flex-start", gap: 16, cursor: "pointer" }}
      >
        <CompanyLogo name={agency ?? title} size={44} />
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
            {networkStatus && (
              <span
                style={{
                  padding: "2px 8px",
                  border: border.line,
                  fontFamily: fontSans,
                  fontSize: T.label,
                  fontWeight: 600,
                  color: color.forest,
                }}
              >
                {networkStatus}
              </span>
            )}
            {networkId && (
              <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight }}>{networkId}</span>
            )}
          </div>

          <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{title}</p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 10px" }}>
            {[agency, sharedAt ? `most_recently_shared_at: ${sharedAt}` : null].filter(Boolean).join(" · ")}
          </p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {locationParts.map((part) => (
              <span key={part} style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {part}
              </span>
            ))}
            {remoteOption && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {remoteOption}
              </span>
            )}
            {jobType && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {jobType}
              </span>
            )}
            {compensation && (
              <span
                style={{
                  padding: "2px 8px",
                  border: "1px solid rgba(26,58,47,0.22)",
                  background: "rgba(26,58,47,0.05)",
                  fontFamily: fontMono,
                  fontSize: T.caption,
                  fontWeight: 600,
                  color: color.forest,
                }}
              >
                {compensation}
              </span>
            )}
          </div>

          {summary && (
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.stone,
                lineHeight: 1.55,
                margin: "0 0 12px",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {summary}
            </p>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingTop: 12,
              borderTop: border.line,
            }}
          >
            {recruiter && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                recruiter: <span style={{ fontWeight: 600, color: color.stone }}>{recruiter}</span>
              </p>
            )}
            <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, flexShrink: 0 }}>
              View all fields →
            </span>
          </div>
        </div>
      </div>
    </ScoutBox>
  );
}

export function PipelineNetworkSection({ jobs = SEED_NETWORK_JOBS, onOpenJob }: PipelineNetworkSectionProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statuses = [...new Set(jobs.map((j) => rawFieldString(j.raw, "network_status", "networkStatus")).filter(Boolean) as string[])];

  const filtered =
    statusFilter === "all"
      ? jobs
      : jobs.filter((j) => rawFieldString(j.raw, "network_status", "networkStatus") === statusFilter);

  return (
    <div style={{ padding: "32px 36px 48px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: "#C4A86A", display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>Premium recruiter network</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={36} style={{ marginBottom: 10 }}>
          In-network & second-tier roles
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
          These openings come from trusted recruiters in the Second Ladder network — not public job boards.
          Click a role to see every Top Echelon field exactly as returned by the API.
        </p>
      </div>

      {statuses.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {["all", ...statuses].map((id) => {
            const active = statusFilter === id;
            const count =
              id === "all" ? jobs.length : jobs.filter((j) => rawFieldString(j.raw, "network_status", "networkStatus") === id).length;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                style={{
                  padding: "6px 12px",
                  color: active ? color.forest : color.muted,
                  border: active ? border.lineStrong : border.line,
                  borderRadius: 0,
                  background: active ? surface.card : "transparent",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {id === "all" ? "All roles" : id}
                <span style={{ fontFamily: fontMono, fontSize: T.label, opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 ? (
          <ScoutBox style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: color.mutedLight, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
              No roles match this filter.
            </p>
          </ScoutBox>
        ) : (
          filtered.map((job) => <NetworkJobCard key={job.id} job={job} onOpen={() => onOpenJob(job)} />)
        )}
      </div>
    </div>
  );
}
