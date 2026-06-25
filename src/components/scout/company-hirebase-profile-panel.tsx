"use client";

import { useEffect } from "react";
import { useHirebaseCompanyProfile } from "@/hooks/useHirebaseCompanyProfile";
import type { HirebaseCompanyProfile } from "@/lib/hirebase";
import type { CompanyEnrichmentCache } from "@/lib/hirebase-company-sync";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";

function formatEmployeeRange(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()}`;
  if (min != null) return `${min.toLocaleString()}+`;
  if (max != null) return `Up to ${max.toLocaleString()}`;
  return null;
}

function formatYesNo(value: boolean | null | undefined): string | null {
  if (value == null) return null;
  return value ? "Yes" : "No";
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontFamily: fontSans,
          fontSize: T.caption,
          fontWeight: 600,
          color: color.muted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.55 }}>{value}</div>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            padding: "4px 10px",
            background: surface.inset,
            border: border.line,
            fontFamily: fontSans,
            fontSize: 12,
            color: color.stone,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function CompanyHirebaseProfilePanel({
  companyName,
  website,
  slugHint,
  trackedId,
  initialProfile,
  onEnrichmentSaved,
}: {
  companyName: string;
  website?: string | null;
  slugHint?: string | null;
  trackedId?: string | null;
  initialProfile?: HirebaseCompanyProfile | null;
  onEnrichmentSaved?: (enrichment: CompanyEnrichmentCache) => void;
}) {
  const { data, loading } = useHirebaseCompanyProfile({
    companyName,
    website,
    slugHint,
    trackedId,
    initialProfile,
  });

  useEffect(() => {
    if (data?.enrichment && data.cached === false && onEnrichmentSaved) {
      onEnrichmentSaved(data.enrichment);
    }
  }, [data, onEnrichmentSaved]);

  const profile = data?.profile;
  const enrichment = data?.enrichment;
  const summary = profile?.description_summary?.trim() || enrichment?.description?.trim() || "";
  const linkedinUrl = profile?.linkedin_link?.trim() || enrichment?.hirebase?.linkedinLink?.trim() || null;
  const websiteUrl =
    profile?.company_link?.trim() || enrichment?.websiteUrl?.trim() || website?.trim() || null;
  const employeeCount =
    formatEmployeeRange(profile?.size_range?.min, profile?.size_range?.max) ||
    enrichment?.employeeCount ||
    null;
  const industries = [...new Set([...(profile?.industries ?? []), ...(enrichment?.industry ? [enrichment.industry] : [])])];
  const subindustries = [...new Set([...(profile?.subindustries ?? []), ...(enrichment?.subindustries ?? [])])];
  const services = profile?.services?.length ? profile.services : enrichment?.services ?? [];
  const openJobs =
    profile?.sample_open_jobs && profile.sample_open_jobs > 0
      ? profile.sample_open_jobs
      : enrichment?.hirebase?.totalOpenJobs;

  if (loading && !profile && !summary) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
        Loading company information…
      </p>
    );
  }

  if (data?.error && !profile && !summary) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.55 }}>
        Company information isn&apos;t available for this employer yet.
      </p>
    );
  }

  return (
    <div>
      {summary ? (
        <InfoBlock
          label="Overview"
          value={<p style={{ margin: 0, lineHeight: 1.65 }}>{summary}</p>}
        />
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "4px 24px",
          marginBottom: industries.length || subindustries.length || services.length ? 8 : 0,
        }}
      >
        <InfoBlock label="Company size" value={employeeCount} />
        <InfoBlock
          label="Open roles"
          value={openJobs != null && openJobs > 0 ? openJobs.toLocaleString() : null}
        />
        <InfoBlock label="Careers platform" value={profile?.job_board ?? enrichment?.hirebase?.jobBoard ?? null} />
        <InfoBlock label="Company type" value={profile?.company_type ?? enrichment?.companyType ?? null} />
        <InfoBlock
          label="Recruiting agency"
          value={formatYesNo(profile?.is_recruiting_agency ?? enrichment?.isRecruitingAgency ?? undefined)}
        />
        <InfoBlock
          label="Third-party agency"
          value={formatYesNo(profile?.is_third_party_agency ?? undefined)}
        />
        <InfoBlock
          label="Website"
          value={
            websiteUrl ? (
              <a
                href={websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: color.forest, fontWeight: 600, textDecoration: "none" }}
              >
                {websiteUrl.replace(/^https?:\/\//, "")} ↗
              </a>
            ) : null
          }
        />
        <InfoBlock
          label="LinkedIn"
          value={
            linkedinUrl ? (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: color.forest, fontWeight: 600, textDecoration: "none" }}
              >
                Company page ↗
              </a>
            ) : null
          }
        />
      </div>

      {industries.length > 0 && <InfoBlock label="Industries" value={<TagList items={industries} />} />}
      {subindustries.length > 0 && <InfoBlock label="Sub-industries" value={<TagList items={subindustries} />} />}
      {services.length > 0 && <InfoBlock label="Services" value={<TagList items={services} />} />}

      {profile?.sample_roles && profile.sample_roles.length > 0 && (
        <InfoBlock
          label="Sample open roles"
          value={
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {profile.sample_roles.map((role, index) => (
                <li
                  key={`${role.title}-${index}`}
                  style={{
                    padding: "8px 0",
                    borderBottom: index < profile.sample_roles.length - 1 ? border.line : undefined,
                  }}
                >
                  {role.url ? (
                    <a
                      href={role.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: fontSans,
                        fontSize: T.bodySm,
                        color: color.forest,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {role.title} ↗
                    </a>
                  ) : (
                    <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, fontWeight: 600 }}>
                      {role.title}
                    </span>
                  )}
                  {role.location && (
                    <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 2 }}>
                      {role.location}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
}
