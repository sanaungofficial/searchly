"use client";

import { useHirebaseCompanyProfile } from "@/hooks/useHirebaseCompanyProfile";
import { ScoutBox } from "./scout-box";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";

function formatEmployeeRange(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()} employees`;
  if (min != null) return `${min.toLocaleString()}+ employees`;
  if (max != null) return `Up to ${max.toLocaleString()} employees`;
  return null;
}

function MetaChip({ label }: { label: string }) {
  return (
    <span
      style={{
        background: surface.inset,
        border: border.line,
        padding: "4px 10px",
        fontFamily: fontSans,
        fontSize: 13,
        color: color.stone,
      }}
    >
      {label}
    </span>
  );
}

export function CompanyHirebaseProfilePanel({
  companyName,
  website,
  slugHint,
}: {
  companyName: string;
  website?: string | null;
  slugHint?: string | null;
}) {
  const { data, loading } = useHirebaseCompanyProfile({
    companyName,
    website,
    slugHint,
  });

  const profile = data?.profile;
  const enrichment = data?.enrichment;
  const summary =
    profile?.description_summary?.trim() ||
    enrichment?.description?.trim() ||
    "";
  const linkedinUrl =
    profile?.linkedin_link?.trim() ||
    enrichment?.hirebase?.linkedinLink?.trim() ||
    null;
  const websiteUrl =
    profile?.company_link?.trim() ||
    enrichment?.websiteUrl?.trim() ||
    website?.trim() ||
    null;
  const employeeLabel = formatEmployeeRange(profile?.size_range?.min, profile?.size_range?.max);
  const openJobs =
    profile?.sample_open_jobs && profile.sample_open_jobs > 0
      ? profile.sample_open_jobs
      : enrichment?.hirebase?.totalOpenJobs;
  const industries = [
    ...(profile?.industries ?? []),
    ...(profile?.subindustries ?? []).slice(0, 4),
    enrichment?.industry ? [enrichment.industry] : [],
  ].filter(Boolean);
  const uniqueIndustries = [...new Set(industries)].slice(0, 8);

  if (loading && !profile && !summary) {
    return (
      <ScoutBox padding="14px 16px">
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          Loading company information…
        </p>
      </ScoutBox>
    );
  }

  if (data?.error && !profile && !summary) {
    return (
      <ScoutBox padding="14px 16px">
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.55 }}>
          {data.configured
            ? "Company information from Hirebase isn't available for this employer yet."
            : "Hirebase is not configured on this environment."}
        </p>
      </ScoutBox>
    );
  }

  return (
    <ScoutBox padding="14px 16px">
      {profile?.company_slug && (
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 12px" }}>
          Verified on Hirebase · {profile.company_slug}
        </p>
      )}

      {(employeeLabel || enrichment?.employeeCount || openJobs != null || profile?.job_board) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: summary ? 12 : 0 }}>
          {employeeLabel && <MetaChip label={employeeLabel} />}
          {!employeeLabel && enrichment?.employeeCount && (
            <MetaChip label={`${enrichment.employeeCount} employees`} />
          )}
          {openJobs != null && openJobs > 0 && (
            <MetaChip label={`${openJobs.toLocaleString()} open roles`} />
          )}
          {profile?.job_board && <MetaChip label={`via ${profile.job_board}`} />}
        </div>
      )}

      {uniqueIndustries.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: summary ? 12 : 0 }}>
          {uniqueIndustries.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "4px 10px",
                background: "rgba(74,139,106,0.12)",
                fontFamily: fontSans,
                fontSize: 12,
                fontWeight: 500,
                color: color.forest,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {summary ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.65, margin: "0 0 12px" }}>
          {summary}
        </p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {linkedinUrl && (
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, fontWeight: 600, textDecoration: "none" }}
          >
            LinkedIn ↗
          </a>
        )}
        {websiteUrl && (
          <a
            href={websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, fontWeight: 600, textDecoration: "none" }}
          >
            Website ↗
          </a>
        )}
      </div>
    </ScoutBox>
  );
}
