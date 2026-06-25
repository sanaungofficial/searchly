"use client";

import { useCallback, useEffect, useState } from "react";
import { formatSumbleFunding, formatSumbleGrowth } from "@/lib/sumble";
import type { CompanySumbleIntelBundle } from "@/lib/sumble-intel-service";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, type as T } from "@/lib/typography";

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
  const [data, setData] = useState<CompanySumbleIntelBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ name: companyName });
        if (trackedId) params.set("trackedId", trackedId);
        if (website?.trim()) params.set("domain", website.trim());
        if (refresh) params.set("refresh", "1");
        const res = await fetch(`/api/companies/sumble-intel?${params}`);
        const body = (await res.json()) as CompanySumbleIntelBundle;
        setData(body);
        if (!res.ok || (body.error && !body.organization)) {
          setError(body.error ?? "Could not load Sumble intelligence.");
        }
      } catch {
        setError("Network error loading Sumble intelligence.");
      } finally {
        setLoading(false);
      }
    },
    [trackedId, companyName, website]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading && !data?.organization) {
    return (
      <ScoutBox padding="14px 16px">
        <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.forest, margin: 0 }}>
          Loading Sumble intelligence…
        </p>
      </ScoutBox>
    );
  }

  if (error && !data?.organization) {
    return (
      <ScoutBox padding="14px 16px">
        <ScoutLabel>Sumble intelligence</ScoutLabel>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
          {error}
        </p>
        {!data?.configured && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
            Set SUMBLE_API_KEY on Vercel preview + prod.
          </p>
        )}
      </ScoutBox>
    );
  }

  if (!data?.organization) return null;

  const org = data.organization;
  const funding = formatSumbleFunding(org.funding_total_raised);

  return (
    <div>
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
          <ScoutLabel>Sumble intelligence</ScoutLabel>
          {data.sumbleUrl && (
            <a
              href={data.sumbleUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.muted,
                display: "block",
                marginTop: 4,
                textDecoration: "none",
              }}
            >
              View on Sumble ↗
            </a>
          )}
        </div>
        <ScoutSecondaryBtn onClick={() => void load(true)} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </ScoutSecondaryBtn>
      </div>

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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {entity.job_post_count != null && (
                    <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.forest }}>
                      {entity.job_post_count} open roles
                    </span>
                  )}
                  {entity.people_count != null && (
                    <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                      {entity.people_count.toLocaleString()} people
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

      {data.people.length > 0 && (
        <ScoutBox padding="12px 14px">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <ScoutLabel>Key people</ScoutLabel>
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

      {data.signals.length === 0 && data.people.length === 0 && !data.roleMetrics.length && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.5 }}>
          Sumble matched this organization but returned no signals or people for your filters yet.
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
