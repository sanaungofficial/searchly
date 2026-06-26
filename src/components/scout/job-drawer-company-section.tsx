"use client";

import { CompanyLogo } from "@/components/scout/company-logo";
import type { HirebaseCompanyProfileResponse } from "@/lib/hirebase-company-profile";
import { fontSans, border as B, surface, color, displayTitleStyle, type as T } from "@/lib/typography";
import { ScoutBox } from "./scout-box";

const sans = fontSans;
const line = B.line;

function formatEmployeeRange(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()} employees`;
  if (min != null) return `${min.toLocaleString()}+ employees`;
  if (max != null) return `Up to ${max.toLocaleString()} employees`;
  return null;
}

function formatYesNo(value: boolean | null | undefined): string | null {
  if (value == null) return null;
  return value ? "Yes" : "No";
}

function CompanyMetaChip({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: "5px 10px",
        background: surface.inset,
        border: line,
        borderRadius: "var(--scout-radius)",
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

function DetailBlock({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontFamily: sans, fontSize: T.caption, fontWeight: 600, color: color.muted, margin: "0 0 4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </p>
      <div style={{ fontFamily: sans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.55 }}>{value}</div>
    </div>
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
  const employeeLabel =
    formatEmployeeRange(profile?.size_range?.min, profile?.size_range?.max) ||
    enrichment?.employeeCount ||
    null;
  const openJobs =
    profile?.sample_open_jobs && profile.sample_open_jobs > 0
      ? profile.sample_open_jobs
      : enrichment?.hirebase?.totalOpenJobs;
  const industries = [
    ...(profile?.industries ?? []),
    ...(enrichment?.industry ? [enrichment.industry] : []),
  ].filter(Boolean);
  const subindustries = [
    ...(profile?.subindustries ?? []),
    ...(enrichment?.subindustries ?? []),
  ].filter(Boolean);
  const services = profile?.services?.length ? profile.services : enrichment?.services ?? [];
  const uniqueIndustries = [...new Set(industries)].slice(0, 6);
  const uniqueSubindustries = [...new Set(subindustries)].slice(0, 4);
  const companyType = profile?.company_type ?? enrichment?.companyType ?? null;
  const hasRichProfile = Boolean(profile || enrichment?.description || enrichment?.hirebase?.slug);
  const showLimitedNote = !loading && !summary && !hasRichProfile;

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
          {(location || enrichment?.headquarters) && (
            <p style={{ fontFamily: sans, fontSize: 14, color: "var(--scout-muted)", margin: "6px 0 0" }}>
              {enrichment?.headquarters?.trim() || location}
            </p>
          )}
          {profile?.company_slug && (
            <p style={{ fontFamily: sans, fontSize: 12, color: "#8A8278", margin: "4px 0 0" }}>
              Verified on Hirebase · {profile.company_slug}
            </p>
          )}
        </div>
      </div>

      {(employeeLabel || openJobs != null || profile?.job_board || enrichment?.hirebase?.jobBoard) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: summary ? 14 : 0 }}>
          {employeeLabel && <CompanyMetaChip label={employeeLabel} />}
          {openJobs != null && openJobs > 0 && (
            <CompanyMetaChip label={`${openJobs.toLocaleString()} open roles`} />
          )}
          {(profile?.job_board || enrichment?.hirebase?.jobBoard) && (
            <CompanyMetaChip label={`via ${profile?.job_board ?? enrichment?.hirebase?.jobBoard}`} />
          )}
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
                borderRadius: "var(--scout-radius)",
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "4px 20px",
          marginBottom: 16,
        }}
      >
        <DetailBlock label="Company type" value={companyType} />
        <DetailBlock label="Founded" value={enrichment?.founded?.trim()} />
        <DetailBlock label="Funding" value={enrichment?.fundingStage?.trim()} />
        <DetailBlock
          label="Recruiting agency"
          value={formatYesNo(profile?.is_recruiting_agency ?? enrichment?.isRecruitingAgency ?? undefined)}
        />
      </div>

      {uniqueSubindustries.length > 0 && (
        <DetailBlock
          label="Sub-industries"
          value={
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {uniqueSubindustries.map((tag) => (
                <span key={tag} style={{ padding: "4px 10px", background: surface.inset, border: line, fontFamily: sans, fontSize: 12, color: color.stone }}>
                  {tag}
                </span>
              ))}
            </div>
          }
        />
      )}

      {services.length > 0 && (
        <DetailBlock
          label="Services"
          value={
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {services.slice(0, 8).map((item) => (
                <span key={item} style={{ padding: "4px 10px", background: surface.inset, border: line, fontFamily: sans, fontSize: 12, color: color.stone }}>
                  {item}
                </span>
              ))}
            </div>
          }
        />
      )}

      {profile?.sample_roles && profile.sample_roles.length > 0 && (
        <DetailBlock
          label="Other open roles at this company"
          value={
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {profile.sample_roles.slice(0, 5).map((role, index) => (
                <li
                  key={`${role.title}-${index}`}
                  style={{
                    padding: "8px 0",
                    borderBottom: index < Math.min(profile.sample_roles.length, 5) - 1 ? line : undefined,
                  }}
                >
                  {role.url ? (
                    <a
                      href={role.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: sans, fontSize: T.bodySm, color: color.forest, fontWeight: 600, textDecoration: "none" }}
                    >
                      {role.title} ↗
                    </a>
                  ) : (
                    <span style={{ fontFamily: sans, fontSize: T.bodySm, color: color.ink, fontWeight: 600 }}>{role.title}</span>
                  )}
                  {role.location && (
                    <div style={{ fontFamily: sans, fontSize: T.caption, color: color.muted, marginTop: 2 }}>{role.location}</div>
                  )}
                </li>
              ))}
            </ul>
          }
        />
      )}

      {showLimitedNote && (
        <p style={{ fontFamily: sans, fontSize: 13, color: color.mutedLight, margin: "0 0 16px", lineHeight: 1.5 }}>
          Hirebase has limited company data for this employer — what you see above is what we received from the job posting and company index.
        </p>
      )}

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
