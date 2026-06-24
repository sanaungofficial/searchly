"use client";

import { useState } from "react";
import type { NetworkJobListing } from "@/lib/network-job";
import { daysSince, networkTierLabel, SEED_NETWORK_JOBS } from "@/lib/network-job";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

interface PipelineNetworkSectionProps {
  jobs?: NetworkJobListing[];
  onOpenJob: (job: NetworkJobListing) => void;
}

function NetworkJobCard({ job, onOpen }: { job: NetworkJobListing; onOpen: () => void }) {
  const company = job.companyName ?? "Confidential employer";
  const days = daysSince(job.sharedAt);
  const daysLabel = days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days}d ago`;
  const tierLabel = networkTierLabel(job.networkTier);
  const summary = job.description.split("\n").find((l) => l.trim().length > 40)?.trim() ?? job.description.slice(0, 160);

  return (
    <ScoutBox
      stack
      padding={18}
      style={{
        cursor: "pointer",
        borderTop: "3px solid rgba(196,168,106,0.55)",
      }}
      onClick={onOpen}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
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
              {tierLabel}
            </span>
            <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight }}>{job.networkId}</span>
          </div>

          <p style={displayTitleStyle(T.heading, { margin: "0 0 4px", lineHeight: 1.15 })}>{job.positionTitle}</p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 10px" }}>
            {company} · Shared {daysLabel}
          </p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
              {job.location}
            </span>
            {job.remoteOption && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {job.remoteOption}
              </span>
            )}
            {job.jobType && (
              <span style={{ padding: "2px 8px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                {job.jobType}
              </span>
            )}
            <span
              style={{
                padding: "2px 8px",
                border: "1px solid rgba(26,58,47,0.22)",
                background: "rgba(26,58,47,0.05)",
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: 600,
                color: color.forest,
              }}
            >
              {job.salary}
            </span>
          </div>

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
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
              Posted by <span style={{ fontWeight: 600, color: color.stone }}>{job.recruiterName}</span>
              {job.recruiterAgency ? ` · ${job.recruiterAgency}` : ""}
            </p>
            <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, flexShrink: 0 }}>
              View role →
            </span>
          </div>
        </div>
      </div>
    </ScoutBox>
  );
}

export function PipelineNetworkSection({ jobs = SEED_NETWORK_JOBS, onOpenJob }: PipelineNetworkSectionProps) {
  const [tierFilter, setTierFilter] = useState<"all" | "in-network" | "second-tier">("all");

  const filtered =
    tierFilter === "all" ? jobs : jobs.filter((j) => j.networkTier === tierFilter);

  const tierChips: Array<["all" | "in-network" | "second-tier", string]> = [
    ["all", "All network roles"],
    ["in-network", "In-network"],
    ["second-tier", "Second-tier network"],
  ];

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
          They are shared privately through Top Echelon Big Biller.
        </p>
      </div>

      <ScoutBox stack padding={20} style={{ marginBottom: 24, background: "rgba(196,168,106,0.05)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>◆</span>
          <div>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 6px" }}>
              Why these look different
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: 0 }}>
              Each listing includes recruiter notes, network IDs, and placement context you will not find on LinkedIn or Indeed.
              {jobs.length <= 5 ? " Showing preview sample roles while the full catalog syncs." : ""}
            </p>
          </div>
        </div>
      </ScoutBox>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {tierChips.map(([id, label]) => {
          const active = tierFilter === id;
          const count = id === "all" ? jobs.length : jobs.filter((j) => j.networkTier === id).length;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTierFilter(id)}
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
              {label}
              <span style={{ fontFamily: fontMono, fontSize: T.label, opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 ? (
          <ScoutBox style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: color.mutedLight, fontFamily: fontSans, fontSize: T.bodySm, margin: 0 }}>
              No roles match this filter.
            </p>
          </ScoutBox>
        ) : (
          filtered.map((job) => (
            <NetworkJobCard key={job.id} job={job} onOpen={() => onOpenJob(job)} />
          ))
        )}
      </div>
    </div>
  );
}
