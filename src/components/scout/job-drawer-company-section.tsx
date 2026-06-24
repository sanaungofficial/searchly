"use client";

import { CompanyLogo } from "@/components/scout/company-logo";
import type { HirebaseCompanyProfileResponse } from "@/lib/hirebase-company-profile";
import { fontSans, border as B, surface, color, displayTitleStyle } from "@/lib/typography";
import { ScoutBox } from "./scout-box";

const sans = fontSans;
const line = B.line;

function formatEmployeeRange(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()} employees`;
  if (min != null) return `${min.toLocaleString()}+ employees`;
  if (max != null) return `Up to ${max.toLocaleString()} employees`;
  return null;
}

function CompanyMetaChip({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: "5px 10px",
        background: surface.inset,
        border: line,
        borderRadius: 0,
        fontFamily: sans,
        fontSize: 12,
        fontWeight: 500,
        color: "#5C534A",
      }}
    >
      {label}
    </span>
  );
}

export function JobDrawerCompanySection({
  companyName,
  location,
  parsedSummary,
  jobUrl,
  hirebase,
  loading,
  trackPanel,
}: {
  companyName: string;
  location: string | null | undefined;
  parsedSummary: string;
  jobUrl: string | null;
  hirebase: HirebaseCompanyProfileResponse | null;
  loading: boolean;
  trackPanel: React.ReactNode;
}) {
  const profile = hirebase?.profile;
  const enrichment = hirebase?.enrichment;
  const summary =
    profile?.description_summary?.trim() ||
    parsedSummary.trim() ||
    enrichment?.description?.trim() ||
    "";
  const linkedinUrl =
    profile?.linkedin_link?.trim() ||
    enrichment?.hirebase?.linkedinLink?.trim() ||
    null;
  const websiteUrl = profile?.company_link?.trim() || enrichment?.websiteUrl?.trim() || jobUrl;
  const employeeLabel = formatEmployeeRange(profile?.size_range?.min, profile?.size_range?.max);
  const openJobs =
    profile?.sample_open_jobs && profile.sample_open_jobs > 0
      ? profile.sample_open_jobs
      : enrichment?.hirebase?.totalOpenJobs;
  const industries = [
    ...(profile?.industries ?? []),
    ...(profile?.subindustries ?? []).slice(0, 3),
  ].filter(Boolean);
  const uniqueIndustries = [...new Set(industries)].slice(0, 6);

  return (
    <ScoutBox padding={20}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <CompanyLogo
          name={companyName}
          website={jobUrl}
          enrichmentWebsiteUrl={websiteUrl}
          logoUrl={profile?.company_logo ?? enrichment?.hirebase?.logo ?? null}
          size={52}
        />
        <div style={{ minWidth: 0 }}>
          <p style={displayTitleStyle(24)}>{companyName}</p>
          {location && (
            <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: "6px 0 0" }}>{location}</p>
          )}
          {profile?.company_slug && (
            <p style={{ fontFamily: sans, fontSize: 12, color: "#8A8278", margin: "4px 0 0" }}>
              Verified on Hirebase · {profile.company_slug}
            </p>
          )}
        </div>
      </div>

      {(employeeLabel || openJobs != null || profile?.job_board) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: summary ? 14 : 0 }}>
          {employeeLabel && <CompanyMetaChip label={employeeLabel} />}
          {openJobs != null && openJobs > 0 && (
            <CompanyMetaChip label={`${openJobs.toLocaleString()} open roles`} />
          )}
          {profile?.job_board && <CompanyMetaChip label={`via ${profile.job_board}`} />}
        </div>
      )}

      {uniqueIndustries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: summary ? 14 : 0 }}>
          {uniqueIndustries.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "5px 11px",
                background: "rgba(74,139,106,0.12)",
                borderRadius: 0,
                fontFamily: sans,
                fontSize: 12,
                fontWeight: 500,
                color: "#2A4A3A",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {summary ? (
        <p style={{ fontFamily: sans, fontSize: 15, color: "#2A2218", lineHeight: 1.7, margin: "0 0 16px" }}>{summary}</p>
      ) : loading ? (
        <p style={{ fontFamily: sans, fontSize: 14, color: "#8A8278", margin: "0 0 16px" }}>Loading company profile…</p>
      ) : hirebase?.error && hirebase.configured ? (
        <p style={{ fontFamily: sans, fontSize: 14, color: "#8A8278", margin: "0 0 16px", lineHeight: 1.5 }}>
          Company summary from Hirebase isn&apos;t available for this employer yet.
        </p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        {linkedinUrl && (
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: sans, fontSize: 14, color: color.forest, fontWeight: 600 }}
          >
            View on LinkedIn ↗
          </a>
        )}
        {websiteUrl && websiteUrl !== jobUrl && (
          <a
            href={websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: sans, fontSize: 14, color: color.forest, fontWeight: 600 }}
          >
            Company website ↗
          </a>
        )}
      </div>

      {trackPanel}
    </ScoutBox>
  );
}
