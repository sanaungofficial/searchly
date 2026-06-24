"use client";

import { useLayoutEffect, useState } from "react";
import type { NetworkJobListing } from "@/lib/network-job";
import { daysSince, networkTierLabel, stripHtml } from "@/lib/network-job";
import { CompanyLogo } from "./company-logo";
import { ScoutBox, ScoutLabel } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

interface NetworkJobDrawerProps {
  job: NetworkJobListing;
  onClose: () => void;
  onAddToPipeline?: () => void | Promise<void>;
  addingToPipeline?: boolean;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontFamily: fontSans, fontSize: T.bodySm, lineHeight: 1.5 }}>
      <span style={{ color: color.mutedLight, minWidth: 88, flexShrink: 0 }}>{label}</span>
      <span style={{ color: color.stone, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ ...displayTitleStyle(T.heading), margin: "0 0 12px" }}>{children}</h3>
  );
}

export function NetworkJobDrawer({
  job,
  onClose,
  onAddToPipeline,
  addingToPipeline = false,
}: NetworkJobDrawerProps) {
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    setVisible(true);
  }, []);

  const company = job.companyName ?? "Confidential employer";
  const days = daysSince(job.sharedAt);
  const daysLabel = days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
  const description = stripHtml(job.description);
  const recruiterNotes = job.recruiterNotes ? stripHtml(job.recruiterNotes) : null;
  const tierLabel = networkTierLabel(job.networkTier);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 210 }} />
      <div
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          bottom: 8,
          width: "min(920px, calc(100vw - 16px))",
          maxWidth: "calc(100vw - 16px)",
          background: surface.inset,
          borderRadius: 0,
          overflow: "hidden",
          zIndex: 211,
          boxShadow: "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 28px",
            background: surface.card,
            borderBottom: border.line,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 24,
              color: color.mutedLight,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                padding: "4px 10px",
                background: "rgba(196,168,106,0.18)",
                border: "1px solid rgba(196,168,106,0.45)",
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#6B5A2A",
              }}
            >
              Recruiter network
            </span>
            <span
              style={{
                padding: "4px 10px",
                background: "rgba(26,58,47,0.08)",
                border: border.line,
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 600,
                color: color.forest,
              }}
            >
              {tierLabel}
            </span>
          </div>
          <div style={{ marginLeft: "auto" }}>
            {onAddToPipeline && (
              <button
                type="button"
                onClick={() => void onAddToPipeline()}
                disabled={addingToPipeline}
                style={{
                  padding: "10px 20px",
                  background: addingToPipeline ? "rgba(26,58,47,0.35)" : color.forest,
                  color: color.gold,
                  border: border.lineStrong,
                  borderRadius: 0,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  fontWeight: 700,
                  cursor: addingToPipeline ? "default" : "pointer",
                }}
              >
                {addingToPipeline ? "Adding…" : "Add to pipeline"}
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px 40px" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
            <CompanyLogo name={company} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 6px" }}>
                {company} · Shared {daysLabel}
              </p>
              <h2 style={displayTitleStyle(28, { margin: "0 0 12px", lineHeight: 1.2 })}>{job.positionTitle}</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ padding: "3px 10px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                  {job.location}
                </span>
                {job.remoteOption && (
                  <span style={{ padding: "3px 10px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                    {job.remoteOption}
                  </span>
                )}
                {job.jobType && (
                  <span style={{ padding: "3px 10px", border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                    {job.jobType}
                  </span>
                )}
                <span
                  style={{
                    padding: "3px 10px",
                    border: "1px solid rgba(26,58,47,0.25)",
                    background: "rgba(26,58,47,0.06)",
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    fontWeight: 600,
                    color: color.forest,
                  }}
                >
                  {job.salary}
                </span>
              </div>
            </div>
          </div>

          <ScoutBox
            padding={18}
            style={{
              marginBottom: 24,
              borderTop: "3px solid rgba(196,168,106,0.65)",
              background: "rgba(196,168,106,0.06)",
            }}
          >
            <ScoutLabel style={{ marginBottom: 10 }}>Not a public job board listing</ScoutLabel>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.65, margin: "0 0 14px" }}>
              This role was shared privately through the Second Ladder recruiter network (Top Echelon Big Biller).
              It is not scraped from LinkedIn, Indeed, or a company careers page.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <MetaRow label="Network ID" value={job.networkId} />
              <MetaRow label="Recruiter" value={job.recruiterName} />
              {job.recruiterAgency && <MetaRow label="Agency" value={job.recruiterAgency} />}
              {job.fee && <MetaRow label="Placement fee" value={`${job.fee}${job.feeType === "percentage" ? " of first-year comp" : ""}`} />}
            </div>
          </ScoutBox>

          {recruiterNotes && (
            <div style={{ marginBottom: 24 }}>
              <SectionTitle>Recruiter notes</SectionTitle>
              <ScoutBox padding={18} style={{ borderLeft: `3px solid ${color.forest}`, background: surface.card }}>
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
                  {recruiterNotes}
                </p>
              </ScoutBox>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <SectionTitle>Job description</SectionTitle>
            <div
              style={{
                padding: "18px 20px",
                background: surface.card,
                border: border.line,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.stone,
                lineHeight: 1.75,
                whiteSpace: "pre-wrap",
              }}
            >
              {description}
            </div>
          </div>

          <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.mutedLight, marginTop: 20 }}>
            TE ref {job.externalId} · Synced for preview
          </p>
        </div>
      </div>
    </>
  );
}
