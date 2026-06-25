"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CompaniesByTechStackBundle,
  TechLookupBundle,
} from "@/lib/sumble-tech-stack-service";
import { SUMBLE_ESTIMATED_COSTS } from "@/lib/sumble-credits";
import { SumbleLoadPrompt } from "@/components/scout/market-analytics-ui";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn } from "./scout-box";
import { fontSans, fontMono, color, border, type as T } from "@/lib/typography";

function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function ProfileTechStackPanel({ skills }: { skills: string[] }) {
  const router = useRouter();
  const [lookup, setLookup] = useState<TechLookupBundle | null>(null);
  const [companies, setCompanies] = useState<CompaniesByTechStackBundle | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);

  const probe = useCallback(async () => {
    if (!skills.length) return;
    setLookupLoading(true);
    setCompaniesLoading(true);
    setLookupError(null);
    setCompaniesError(null);
    try {
      const [lookupRes, companiesRes] = await Promise.all([
        fetch("/api/technologies/sumble-lookup"),
        fetch("/api/companies/by-tech-stack?limit=10"),
      ]);
      const lookupBody = (await lookupRes.json()) as TechLookupBundle;
      const companiesBody = (await companiesRes.json()) as CompaniesByTechStackBundle;
      setLookup(lookupBody);
      setCompanies(companiesBody);
      if (lookupBody.error && !lookupBody.resolved.length) setLookupError(lookupBody.error);
      if (companiesBody.error && !companiesBody.organizations.length) setCompaniesError(companiesBody.error);
    } catch {
      setLookupError("Could not check technology cache.");
      setCompaniesError("Could not check company cache.");
    } finally {
      setLookupLoading(false);
      setCompaniesLoading(false);
    }
  }, [skills.length]);

  useEffect(() => {
    void probe();
  }, [probe]);

  const resolveTechnologies = async () => {
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch("/api/technologies/sumble-lookup?load=1", { method: "POST", body: JSON.stringify({ load: true }) });
      const body = (await res.json()) as TechLookupBundle;
      setLookup(body);
      if (!res.ok && !body.resolved.length) setLookupError(body.error ?? "Lookup failed.");
      else setLookupError(null);
    } catch {
      setLookupError("Network error resolving technologies.");
    } finally {
      setLookupLoading(false);
    }
  };

  const findCompanies = async () => {
    setCompaniesLoading(true);
    setCompaniesError(null);
    try {
      const res = await fetch("/api/companies/by-tech-stack?load=1&limit=10");
      const body = (await res.json()) as CompaniesByTechStackBundle;
      setCompanies(body);
      if (!res.ok && !body.organizations.length) setCompaniesError(body.error ?? "Search failed.");
      else setCompaniesError(null);
    } catch {
      setCompaniesError("Network error finding companies.");
    } finally {
      setCompaniesLoading(false);
    }
  };

  const trackCompany = async (org: { name: string; domain: string | null }) => {
    setTracking(org.name);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: org.name,
          website: org.domain?.startsWith("http") ? org.domain : org.domain ? `https://${org.domain}` : null,
        }),
      });
      if (res.ok) router.push("/opportunities/companies");
    } finally {
      setTracking(null);
    }
  };

  if (!skills.length) return null;

  const lookupRequiresLoad = lookup?.requiresLoad ?? !lookup?.resolved.length;
  const companiesRequiresLoad = companies?.requiresLoad ?? !companies?.organizations.length;
  const needsLookupFirst = companies?.requiresLookup ?? (lookupRequiresLoad && !lookup?.resolved.length);

  return (
    <div style={{ marginTop: 28, paddingTop: 24, borderTop: border.line }}>
      <ScoutLabel>Companies using your stack</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 16px", lineHeight: 1.55 }}>
        Resolve your skills to Sumble technologies, then find employers using those tools. Nothing loads automatically.
      </p>

      {lookup?.resolved.length ? (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Resolved technologies
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {lookup.resolved.map((t) => (
              <span
                key={t.slug}
                style={{
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  padding: "6px 10px",
                  background: "rgba(74,139,106,0.12)",
                  border: border.line,
                  color: color.forest,
                }}
                title={t.input}
              >
                {t.name}
              </span>
            ))}
          </div>
          {lookup.unmatched.length > 0 && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "8px 0 0" }}>
              No Sumble match: {lookup.unmatched.slice(0, 8).join(", ")}
              {lookup.unmatched.length > 8 ? ` +${lookup.unmatched.length - 8} more` : ""}
            </p>
          )}
        </div>
      ) : lookupRequiresLoad && !lookupError ? (
        <SumbleLoadPrompt
          title="Resolve your technologies"
          description="Map your skills (Figma, Salesforce, Python, etc.) to canonical Sumble slugs in one batch."
          estimatedCredits={lookup?.estimatedCredits ?? SUMBLE_ESTIMATED_COSTS.techLookup}
          creditsRemaining={lookup?.creditsRemaining}
          loading={lookupLoading}
          onLoad={resolveTechnologies}
          loadLabel="Resolve technologies"
        />
      ) : null}

      {lookupError && !lookup?.resolved.length && (
        <ScoutBox padding="14px 16px" style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>{lookupError}</p>
        </ScoutBox>
      )}

      {needsLookupFirst && !lookupRequiresLoad ? null : companiesRequiresLoad && !companiesError && lookup?.resolved.length ? (
        <SumbleLoadPrompt
          title="Find matching companies"
          description="Search Sumble for organizations using your resolved stack. Results are cached for 24 hours."
          estimatedCredits={companies?.estimatedCredits ?? 10 * SUMBLE_ESTIMATED_COSTS.orgByTechStack}
          creditsRemaining={companies?.creditsRemaining ?? lookup?.creditsRemaining}
          loading={companiesLoading}
          onLoad={findCompanies}
          loadLabel="Find companies"
        />
      ) : null}

      {companiesError && !companies?.organizations.length && (
        <ScoutBox padding="14px 16px" style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>{companiesError}</p>
        </ScoutBox>
      )}

      {companies?.organizations.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {companies.organizations.map((org) => (
            <ScoutBox key={`${org.organizationId}-${org.name}`} padding="14px 16px">
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>
                    {org.name}
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                    {[org.industry, org.headquartersCountry, org.employeeCount ? `${formatCount(org.employeeCount)} employees` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.forest, margin: "6px 0 0" }}>
                    {formatCount(org.matchingJobPosts)} matching job posts · {formatCount(org.matchingPeople)} people
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {org.sumbleUrl && (
                    <a
                      href={org.sumbleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        fontWeight: 600,
                        padding: "8px 12px",
                        border: border.line,
                        color: color.forest,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        minHeight: 36,
                      }}
                    >
                      Sumble ↗
                    </a>
                  )}
                  <ScoutPrimaryBtn
                    onClick={() => trackCompany(org)}
                    disabled={tracking === org.name}
                    style={{ minHeight: 36 }}
                  >
                    {tracking === org.name ? "Adding…" : "Track"}
                  </ScoutPrimaryBtn>
                </div>
              </div>
            </ScoutBox>
          ))}
        </div>
      ) : null}
    </div>
  );
}
