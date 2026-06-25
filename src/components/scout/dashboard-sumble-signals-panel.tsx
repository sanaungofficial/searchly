"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardSumbleSignalsBundle } from "@/lib/sumble-intel-service";
import type { SumbleSignal } from "@/lib/sumble";
import { SumbleLoadPrompt } from "@/components/scout/market-analytics-ui";
import { ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { RefreshIcon } from "./workspace-icons";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

function formatSignalDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function SignalDetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
      <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, minWidth: 88 }}>{label}</span>
      <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.ink, flex: 1 }}>{value}</span>
    </div>
  );
}

function SignalCard({
  signal,
  isMobile,
}: {
  signal: SumbleSignal & { trackedId?: string; organizationId?: number | null };
  isMobile?: boolean;
}) {
  return (
    <ScoutBox padding="14px 16px" style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            padding: "2px 8px",
            background: surface.inset,
            border: border.line,
            fontFamily: fontMono,
            fontSize: T.caption,
            color: color.forest,
            textTransform: "uppercase",
          }}
        >
          {signal.display_type}
        </span>
        {signal.type && (
          <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>{signal.type}</span>
        )}
        <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>{formatSignalDate(signal.date)}</span>
      </div>
      <p style={displayTitleStyle(isMobile ? 16 : 17, { margin: "0 0 6px", lineHeight: 1.35 })}>{signal.title}</p>
      {signal.subtitle && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 8px", lineHeight: 1.5 }}>
          {signal.subtitle}
        </p>
      )}
      {signal.explanation && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.stone, margin: "0 0 8px", lineHeight: 1.55 }}>
          {signal.explanation}
        </p>
      )}
      <SignalDetailRow label="job_function" value={signal.job_function} />
      <SignalDetailRow label="organization" value={signal.organization_name} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
        {signal.sumble_url && (
          <a
            href={signal.sumble_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, textDecoration: "none" }}
          >
            Sumble ↗
          </a>
        )}
        {signal.linkedin_url && (
          <a
            href={signal.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, textDecoration: "none" }}
          >
            LinkedIn ↗
          </a>
        )}
      </div>
    </ScoutBox>
  );
}

function RawJsonExplorer({ data, label }: { data: unknown; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <ScoutBox padding="12px 14px" style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          fontFamily: fontSans,
          fontSize: T.caption,
          fontWeight: 600,
          color: color.forest,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {open ? "Hide" : "Show"} {label}
      </button>
      {open && (
        <pre
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            color: color.stone,
            margin: "10px 0 0",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: surface.inset,
            border: border.line,
            padding: 12,
            maxHeight: 320,
            overflow: "auto",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </ScoutBox>
  );
}

export function DashboardSumbleSignalsPanel({ isMobile }: { isMobile?: boolean }) {
  const [data, setData] = useState<DashboardSumbleSignalsBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresLoad, setRequiresLoad] = useState(true);

  const load = useCallback(async (options?: { refresh?: boolean; fetch?: boolean }) => {
    const refresh = options?.refresh ?? false;
    const shouldFetch = options?.fetch ?? refresh;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "10" });
      if (shouldFetch) params.set("load", "1");
      if (refresh) params.set("refresh", "1");
      const res = await fetch(`/api/dashboard/sumble-signals?${params}`);
      const body = (await res.json()) as DashboardSumbleSignalsBundle;
      setData(body);
      const hasData =
        body.signals.length > 0 ||
        body.companies.some((c) => c.matched || c.signals.length > 0);
      setRequiresLoad(body.requiresLoad ?? !hasData);
      if (!res.ok && !hasData && !body.requiresLoad) {
        setError(body.error ?? "Company signals unavailable.");
      } else if (body.error && !hasData) {
        setError(body.error);
      } else {
        setError(body.error ?? null);
      }
    } catch {
      setError("Could not load Sumble signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ fetch: false });
  }, [load]);

  const hasData =
    (data?.signals.length ?? 0) > 0 ||
    (data?.companies.some((c) => c.matched || c.signals.length > 0) ?? false);

  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 12,
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <ScoutLabel>Watchlist signals · Sumble</ScoutLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href="/opportunities/companies"
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              color: color.forest,
              textDecoration: "none",
              padding: isMobile ? "10px 14px" : "6px 12px",
              border: border.line,
              minHeight: isMobile ? 44 : undefined,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Companies →
          </Link>
          <button
            onClick={() => (requiresLoad ? void load({ fetch: true }) : void load({ fetch: true, refresh: true }))}
            disabled={loading}
            style={{
              background: "none",
              border: border.line,
              cursor: loading ? "wait" : "pointer",
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              color: color.forest,
              padding: isMobile ? "10px 14px" : "6px 12px",
              minHeight: isMobile ? 44 : undefined,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <RefreshIcon /> {requiresLoad ? "Load" : "Refresh"}
          </button>
        </div>
      </div>

      {requiresLoad && !hasData && !loading && !error && (
        <SumbleLoadPrompt
          title="Watchlist signals"
          description="Scan up to 10 tracked companies (priority first) via GET /organizations/{id}/signals. Returns all signals per company — cached 24 hours."
          estimatedCredits={data?.estimatedCredits ?? 40}
          creditsRemaining={data?.creditsRemaining}
          loading={loading}
          onLoad={() => void load({ fetch: true })}
          loadLabel="Load watchlist signals"
        />
      )}

      {loading && !hasData && !requiresLoad && (
        <ScoutBox padding="14px 18px">
          <KimchiProcessLoader preset="marketIntel" title="Loading Sumble signals from your watchlist…" variant="inline" />
        </ScoutBox>
      )}

      {error && !hasData && (
        <ScoutBox padding="14px 18px">
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.5 }}>{error}</p>
        </ScoutBox>
      )}

      {hasData && data && (
        <>
          <ScoutBox padding="14px 16px" style={{ marginBottom: 14 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, margin: 0, lineHeight: 1.55 }}>
              Scanned <strong>{data.companiesScanned}</strong> tracked companies ·{" "}
              <strong>{data.companiesMatched}</strong> matched in Sumble ·{" "}
              <strong>{data.companiesWithSignals}</strong> with signals ·{" "}
              <strong>{data.totalSignals}</strong> total signals
              {data.creditsUsed ? ` · ${data.creditsUsed} credits used` : ""}
              {data.creditsRemaining != null ? ` · ${data.creditsRemaining.toLocaleString()} left` : ""}
              {data.serverCached ? " · cached" : ""}
            </p>
            {data.generatedAt && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0" }}>
                Updated {new Date(data.generatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            )}
          </ScoutBox>

          {data.companies.map((company) => (
            <ScoutBox key={company.trackedId} padding="16px 18px" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                <div>
                  <Link
                    href={`/opportunities/companies/${company.trackedId}`}
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.body,
                      fontWeight: 700,
                      color: color.forest,
                      textDecoration: "none",
                    }}
                  >
                    {company.companyName} ↗
                  </Link>
                  <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: "4px 0 0" }}>
                    {company.domain ?? "no domain"}
                    {company.organizationId != null ? ` · org ${company.organizationId}` : ""}
                    {company.signals.length ? ` · ${company.signals.length} signal${company.signals.length === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                {company.sumbleUrl && (
                  <a
                    href={company.sumbleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, textDecoration: "none" }}
                  >
                    Sumble org ↗
                  </a>
                )}
              </div>

              {!company.matched && (
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                  {company.matchError ?? "Could not match this company in Sumble."}
                </p>
              )}

              {company.matched && company.signals.length === 0 && (
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                  Matched in Sumble — no signals returned for this org.
                </p>
              )}

              {company.signals.map((signal, i) => (
                <SignalCard key={`${company.trackedId}-${signal.date}-${i}`} signal={signal} isMobile={isMobile} />
              ))}

              <RawJsonExplorer data={company} label={`raw data · ${company.companyName}`} />
            </ScoutBox>
          ))}

          <RawJsonExplorer data={data} label="full API response (all companies)" />
        </>
      )}
    </div>
  );
}
