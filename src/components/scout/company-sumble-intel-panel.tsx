"use client";

import { useCallback, useEffect, useState } from "react";
import { hostnameFromUrl } from "@/lib/company-domain";
import { formatSumbleFunding, formatSumbleGrowth } from "@/lib/sumble";
import type { CompanySumbleIntelBundle } from "@/lib/sumble-intel-service";
import { IntelRefreshButton } from "@/components/scout/intel-refresh-button";
import { SumbleLoadPrompt } from "@/components/scout/market-analytics-ui";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, type as T } from "@/lib/typography";

type AccessPayload = {
  allowed: boolean;
  configured: boolean;
  isAdmin: boolean;
};

function formatSignalDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: surface.inset,
        border: border.line,
        padding: "8px 12px",
        minWidth: 100,
      }}
    >
      <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: fontMono, fontSize: T.bodySm, color: color.forest, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function SumbleEnterpriseLocked() {
  return (
    <ScoutBox style={{ marginBottom: 16 }}>
      <ScoutLabel>Sumble intelligence</ScoutLabel>
      <div
        style={{
          marginTop: 12,
          padding: "14px 16px",
          background: surface.inset,
          border: border.line,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, opacity: 0.45 }} aria-hidden>🔒</span>
        <div>
          <div style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, marginBottom: 4 }}>
            Enterprise feature
          </div>
          <div style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
            Company intelligence — org profile, signals, teams, contacts, and research briefs — is included with enterprise coaching.
          </div>
        </div>
      </div>
    </ScoutBox>
  );
}

function PanelHeader({
  loading,
  onRefresh,
  sumbleUrl,
}: {
  loading: boolean;
  onRefresh: () => void;
  sumbleUrl?: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <div>
        {sumbleUrl && (
          <a
            href={sumbleUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              textDecoration: "none",
            }}
          >
            View on Sumble ↗
          </a>
        )}
      </div>
      <IntelRefreshButton onClick={onRefresh} disabled={loading} />
    </div>
  );
}

export function CompanySumbleIntelPanel({
  trackedId,
  companyName,
  website,
  compact,
}: {
  trackedId?: string;
  companyName: string;
  website?: string | null;
  compact?: boolean;
}) {
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [data, setData] = useState<CompanySumbleIntelBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresLoad, setRequiresLoad] = useState(true);
  const [detailLoaded, setDetailLoaded] = useState(false);

  const domainHint = hostnameFromUrl(website) ?? website?.trim() ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoadingAccess(true);
    fetch("/api/companies/sumble-brief/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: AccessPayload | null) => {
        if (!cancelled && payload) setAccess(payload);
      })
      .catch(() => {
        if (!cancelled) setAccess({ allowed: false, configured: false, isAdmin: false });
      })
      .finally(() => {
        if (!cancelled) setLoadingAccess(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    async (options?: { refresh?: boolean; fetch?: boolean; people?: boolean; teams?: boolean }) => {
      const refresh = options?.refresh ?? false;
      const fetchData = options?.fetch ?? refresh;
      const people = options?.people ?? false;
      const teams = options?.teams ?? false;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ name: companyName });
        if (trackedId) params.set("trackedId", trackedId);
        if (domainHint) params.set("domain", domainHint);
        if (fetchData) params.set("load", "1");
        if (refresh) params.set("refresh", "1");
        if (people) params.set("people", "1");
        if (teams) params.set("teams", "1");
        const res = await fetch(`/api/companies/sumble-intel?${params}`);
        const body = (await res.json()) as CompanySumbleIntelBundle;
        if (res.status === 403) {
          setAccess({ allowed: false, configured: body.configured, isAdmin: false });
          return;
        }
        setData(body);
        setRequiresLoad(body.requiresLoad ?? !body.organization);
        if (people || teams) setDetailLoaded(true);
        if (!res.ok || (body.error && !body.organization && !body.requiresLoad)) {
          setError(body.error ?? "Could not load Sumble intelligence.");
        } else if (body.error) {
          setError(body.error);
        } else {
          setError(null);
        }
      } catch {
        setError("Network error loading Sumble intelligence.");
      } finally {
        setLoading(false);
      }
    },
    [trackedId, companyName, domainHint]
  );

  useEffect(() => {
    if (!access?.allowed) return;
    setData(null);
    setError(null);
    setRequiresLoad(true);
    setDetailLoaded(false);
    void load({ fetch: false });
  }, [load, access?.allowed]);

  if (loadingAccess) {
    return (
      <ScoutBox style={{ marginBottom: 16 }}>
        <ScoutLabel>Sumble intelligence</ScoutLabel>
        <div style={{ marginTop: 12, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Loading…</div>
      </ScoutBox>
    );
  }

  if (!access?.allowed) {
    return <SumbleEnterpriseLocked />;
  }

  if (!access.configured) {
    return (
      <ScoutBox style={{ marginBottom: 16 }}>
        <ScoutLabel>Sumble intelligence</ScoutLabel>
        <div style={{ marginTop: 12, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.5 }}>
          Sumble intelligence is not configured on this environment yet.
        </div>
      </ScoutBox>
    );
  }

  if (requiresLoad && !data?.organization) {
    return (
      <SumbleLoadPrompt
        title="Sumble intelligence"
        description={`Load org profile and signals for ${companyName}. People and teams are optional after the base load.`}
        loading={loading}
        onLoad={() => void load({ fetch: true })}
        loadLabel="Load company intel"
      />
    );
  }

  if (loading && !data?.organization) {
    return (
      <ScoutBox padding="14px 16px">
        <PanelHeader loading={loading} onRefresh={() => void load({ fetch: true, refresh: true })} />
        <KimchiProcessLoader preset="marketIntel" title="Loading Sumble intelligence…" variant="inline" />
      </ScoutBox>
    );
  }

  if (error && !data?.organization) {
    return (
      <ScoutBox padding="14px 16px">
        <PanelHeader loading={loading} onRefresh={() => void load({ fetch: true, refresh: true })} />
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 0", lineHeight: 1.5 }}>
          {error}
        </p>
      </ScoutBox>
    );
  }

  if (!data?.organization) return null;

  const org = data.organization;
  const funding = formatSumbleFunding(org.funding_total_raised);

  return (
    <div>
      <PanelHeader loading={loading} onRefresh={() => void load({ fetch: true, refresh: true })} sumbleUrl={data.sumbleUrl} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: compact ? 12 : 16 }}>
        {org.employee_count != null && (
          <StatChip label="Employees" value={org.employee_count.toLocaleString()} />
        )}
        {org.jobs_count != null && <StatChip label="Open roles" value={org.jobs_count.toLocaleString()} />}
        {org.teams_count != null && <StatChip label="Teams" value={org.teams_count.toLocaleString()} />}
        {org.sumble_score != null && (
          <StatChip label="Sumble score" value={Math.round(org.sumble_score).toString()} />
        )}
        {funding && <StatChip label="Total raised" value={funding} />}
      </div>

      {data.roleMetrics.length > 0 && (
        <ScoutBox padding="12px 14px" style={{ marginBottom: compact ? 12 : 16 }}>
          <ScoutLabel>Your target roles</ScoutLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {data.roleMetrics.map((entity) => (
              <div
                key={`${entity.type}-${entity.term}`}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                  borderBottom: border.line,
                  paddingBottom: 8,
                }}
              >
                <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, fontWeight: 600 }}>
                  {entity.term}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  {entity.job_post_count != null && (
                    entity.job_post_count_url ? (
                      <a
                        href={entity.job_post_count_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: fontMono, fontSize: T.caption, color: color.forest, textDecoration: "none" }}
                      >
                        {entity.job_post_count} open roles ↗
                      </a>
                    ) : (
                      <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.forest }}>
                        {entity.job_post_count} open roles
                      </span>
                    )
                  )}
                  {entity.people_count != null && (
                    entity.people_count_url ? (
                      <a
                        href={entity.people_count_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, textDecoration: "none" }}
                      >
                        {entity.people_count.toLocaleString()} people ↗
                      </a>
                    ) : (
                      <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                        {entity.people_count.toLocaleString()} people
                      </span>
                    )
                  )}
                  {entity.team_count != null && entity.team_count > 0 && (
                    <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                      {entity.team_count} teams
                    </span>
                  )}
                  {entity.job_post_count_growth_1y != null && (
                    <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                      {formatSumbleGrowth(entity.job_post_count_growth_1y)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScoutBox>
      )}

      {data.signals.length > 0 && (
        <ScoutBox padding="12px 14px" style={{ marginBottom: compact ? 12 : 16 }}>
          <ScoutLabel>Recent signals</ScoutLabel>
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
            {data.signals.map((signal, i) => (
              <li
                key={`${signal.date}-${signal.title}-${i}`}
                style={{
                  padding: "10px 0",
                  borderBottom: i < data.signals.length - 1 ? border.line : undefined,
                }}
              >
                <div style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, fontWeight: 600 }}>
                  {signal.title}
                </div>
                {signal.subtitle && (
                  <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                    {signal.subtitle}
                  </div>
                )}
                <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, marginTop: 6 }}>
                  {formatSignalDate(signal.date)}
                  {signal.display_type ? ` · ${signal.display_type}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </ScoutBox>
      )}

      {data.teams.length > 0 && (
        <ScoutBox padding="12px 14px" style={{ marginBottom: compact ? 12 : 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <ScoutLabel>Active teams</ScoutLabel>
            {data.teamsSourceUrl && (
              <a
                href={data.teamsSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "none" }}
              >
                All {data.teamsTotal.toLocaleString()} ↗
              </a>
            )}
          </div>
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
            {data.teams.map((team) => {
              const attrs = team.attributes;
              const teamName = team.name?.trim() || attrs?.name?.trim();
              if (!teamName) return null;
              return (
                <li
                  key={team.team_id ?? teamName}
                  style={{ padding: "8px 0", borderBottom: border.line }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                    {team.sumble_url ? (
                      <a
                        href={team.sumble_url}
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
                        {teamName} ↗
                      </a>
                    ) : (
                      <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, fontWeight: 600 }}>
                        {teamName}
                      </span>
                    )}
                    <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                      {attrs.jobs_count != null ? `${attrs.jobs_count} roles` : ""}
                      {attrs.people_count != null ? ` · ${attrs.people_count} people` : ""}
                    </span>
                  </div>
                  {attrs.technology_list && attrs.technology_list.length > 0 && (
                    <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                      {attrs.technology_list.slice(0, 4).join(" · ")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </ScoutBox>
      )}

      {data.people.length > 0 && (
        <ScoutBox padding="12px 14px" style={{ marginBottom: compact ? 12 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <ScoutLabel>
              {data.peopleFilteredByRole && data.jobFunctionTerms[0]
                ? `People · ${data.jobFunctionTerms[0]}`
                : "Key people"}
            </ScoutLabel>
            {data.peopleSourceUrl && (
              <a
                href={data.peopleSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "none" }}
              >
                All {data.peopleTotal.toLocaleString()} ↗
              </a>
            )}
          </div>
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
            {data.people.map((person) => {
              const attrs = person.attributes;
              if (!attrs?.name) return null;
              return (
                <li
                  key={person.person_id ?? attrs.name}
                  style={{
                    padding: "8px 0",
                    borderBottom: border.line,
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8 }}>
                    {attrs.linkedin_url ? (
                      <a
                        href={attrs.linkedin_url}
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
                        {attrs.name} ↗
                      </a>
                    ) : (
                      <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, fontWeight: 600 }}>
                        {attrs.name}
                      </span>
                    )}
                    {attrs.job_level && (
                      <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                        {attrs.job_level}
                      </span>
                    )}
                  </div>
                  {attrs.job_title && (
                    <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                      {attrs.job_title}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </ScoutBox>
      )}

      {!detailLoaded && data.people.length === 0 && data.teams.length === 0 && (
        <ScoutBox padding="12px 14px" style={{ marginBottom: compact ? 12 : 16 }}>
          <ScoutLabel>People & teams</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 12px", lineHeight: 1.5 }}>
            Optional — load key people and active teams for deeper research.
          </p>
          <ScoutSecondaryBtn
            onClick={() => void load({ fetch: true, people: true, teams: true })}
            disabled={loading}
            style={{ minHeight: 40 }}
          >
            {loading ? "Loading…" : "Load people & teams"}
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      {data.signals.length === 0 &&
        data.people.length === 0 &&
        data.teams.length === 0 &&
        !data.roleMetrics.length && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.5 }}>
          Sumble matched this organization but returned no signals, teams, or people for your filters yet.
        </p>
      )}

      {data.generatedAt && !compact && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "12px 0 0" }}>
          Updated {new Date(data.generatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          {data.serverCached ? " · cached" : ""}
        </p>
      )}
    </div>
  );
}
