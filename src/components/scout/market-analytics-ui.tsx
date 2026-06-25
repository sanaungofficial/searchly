"use client";

import Link from "next/link";
import type { HirebaseInsightsResponse, InsightsKeyCount } from "@/lib/hirebase-insights";
import { formatInsightsSalary, formatSalaryRange } from "@/lib/hirebase-insights";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import type { MarketInsightsPayload } from "@/hooks/useMarketInsights";
import { MARKET_WINDOW_OPTIONS } from "@/hooks/useMarketInsights";

export function WindowPicker({
  value,
  onChange,
  isMobile,
}: {
  value: number;
  onChange: (days: number) => void;
  isMobile?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {MARKET_WINDOW_OPTIONS.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          style={{
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            padding: isMobile ? "10px 12px" : "6px 12px",
            minHeight: isMobile ? 44 : undefined,
            cursor: "pointer",
            background: value === days ? surface.inset : surface.card,
            border: value === days ? border.lineStrong : border.line,
            color: value === days ? color.forest : color.muted,
          }}
        >
          {days}d
        </button>
      ))}
    </div>
  );
}

export function InsightsMetaRow({
  payload,
  onRefresh,
  loading,
}: {
  payload: MarketInsightsPayload | null;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  if (!payload) return null;
  const updated = payload.generatedAt
    ? new Date(payload.generatedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
        {payload.roleLabel}
        {payload.dataSource === "sumble" ? " · Sumble" : ""}
        {updated ? ` · Updated ${updated}` : ""}
        {payload.serverCached ? " · cached" : ""}
        {payload.creditsRemaining != null ? ` · ${payload.creditsRemaining.toLocaleString()} credits left` : ""}
      </span>
      {onRefresh && (
        <ScoutSecondaryBtn onClick={onRefresh} disabled={loading} style={{ minHeight: 36, padding: "6px 12px" }}>
          {loading ? "Refreshing…" : "Refresh"}
        </ScoutSecondaryBtn>
      )}
    </div>
  );
}

export function InsightsEmpty({
  message,
  configured,
}: {
  message: string;
  configured?: boolean;
}) {
  return (
    <ScoutBox padding="24px 22px" style={{ textAlign: "center" }}>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
        {message}
      </p>
      {configured === false && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: 0 }}>
          Market insights require SUMBLE_API_KEY on the server (set on Vercel preview + prod).
        </p>
      )}
      {configured && (
        <Link
          href="/profile/dream-role"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
            marginTop: 8,
            padding: "10px 16px",
            fontFamily: fontSans,
            fontSize: T.bodySm,
            fontWeight: 600,
            textDecoration: "none",
            background: color.forest,
            color: surface.card,
            border: border.lineStrong,
          }}
        >
          Set target roles
        </Link>
      )}
    </ScoutBox>
  );
}

export function SumbleLoadPrompt({
  title,
  description,
  estimatedCredits,
  creditsRemaining,
  loading,
  onLoad,
  loadLabel = "Load from Sumble",
}: {
  title: string;
  description: string;
  estimatedCredits?: number;
  creditsRemaining?: number | null;
  loading?: boolean;
  onLoad: () => void;
  loadLabel?: string;
}) {
  return (
    <ScoutBox padding="24px 22px" style={{ textAlign: "center" }}>
      <ScoutLabel>{title}</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "10px 0 16px", lineHeight: 1.55 }}>
        {description}
      </p>
      {estimatedCredits != null && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "0 0 14px" }}>
          Uses ~{estimatedCredits} Sumble credits per load. Data is cached for 24 hours after loading.
          {creditsRemaining != null ? ` ${creditsRemaining.toLocaleString()} credits remaining.` : ""}
        </p>
      )}
      <ScoutSecondaryBtn
        onClick={onLoad}
        disabled={loading}
        style={{ minHeight: 44, padding: "10px 18px", fontWeight: 600 }}
      >
        {loading ? "Loading…" : loadLabel}
      </ScoutSecondaryBtn>
    </ScoutBox>
  );
}

export function KpiGrid({
  insight,
  isMobile,
}: {
  insight: HirebaseInsightsResponse;
  isMobile?: boolean;
}) {
  const h = insight.headline;
  const currency = h?.salary_currency ?? insight.salary?.currency ?? "USD";
  const items = [
    { label: "Active roles", value: h?.total_count?.toLocaleString() ?? "—" },
    { label: "New this week", value: h?.new_this_week?.toLocaleString() ?? "—" },
    {
      label: "Median salary",
      value: h?.median_salary != null ? formatInsightsSalary(h.median_salary, currency) ?? "—" : "—",
    },
    { label: "Remote", value: h?.pct_remote != null ? `${Math.round(h.pct_remote)}%` : "—" },
    { label: "Top tech", value: h?.top_technology ?? "—" },
    { label: "Top level", value: h?.dominant_experience_level ?? "—" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
        gap: 10,
        marginBottom: 20,
      }}
    >
      {items.map((item) => (
        <ScoutBox key={item.label} padding="16px 18px">
          <ScoutLabel>{item.label}</ScoutLabel>
          <p style={{ ...displayTitleStyle(isMobile ? 20 : 24, { margin: "8px 0 0", lineHeight: 1.1 }) }}>
            {item.value}
          </p>
        </ScoutBox>
      ))}
    </div>
  );
}

export function RankList({
  title,
  items,
  renderLabel,
}: {
  title: string;
  items: InsightsKeyCount[];
  renderLabel?: (item: InsightsKeyCount) => string;
}) {
  if (!items.length) return null;
  return (
    <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
      <ScoutLabel>{title}</ScoutLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {items.slice(0, 12).map((item) => (
          <div
            key={item.key}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
          >
            <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, fontWeight: 500 }}>
              {renderLabel ? renderLabel(item) : item.key}
            </span>
            <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, flexShrink: 0 }}>
              {item.count.toLocaleString()}
              {item.percent != null ? ` · ${item.percent.toFixed(1)}%` : ""}
            </span>
          </div>
        ))}
      </div>
    </ScoutBox>
  );
}

export function SplitBars({
  title,
  items,
}: {
  title: string;
  items: InsightsKeyCount[];
}) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
      <ScoutLabel>{title}</ScoutLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
        {items.slice(0, 10).map((item) => (
          <div key={item.key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink }}>{item.key}</span>
              <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                {item.percent != null ? `${item.percent.toFixed(1)}%` : item.count}
              </span>
            </div>
            <div style={{ height: 6, background: surface.inset, border: border.line }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round((item.count / max) * 100)}%`,
                  background: color.forest,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </ScoutBox>
  );
}

export function SalaryDeepDive({
  insight,
  dataSource,
}: {
  insight: HirebaseInsightsResponse;
  dataSource?: "sumble" | "none";
}) {
  const s = insight.salary;
  const currency = s?.currency ?? insight.headline?.salary_currency ?? "USD";
  if (!s?.p50 && !insight.headline?.median_salary) {
    return (
      <ScoutBox padding="20px 22px">
        <ScoutLabel>Salary</ScoutLabel>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "10px 0 0" }}>
          {dataSource === "sumble"
            ? "Sumble job listings do not include salary bands yet. Use Overview, Skills, or Companies for demand signals."
            : "Not enough salary disclosures in this cohort."}
          {dataSource !== "sumble" &&
            insight.headline?.pct_disclosing_salary != null &&
            ` Only ${Math.round(insight.headline.pct_disclosing_salary)}% of listings disclose pay.`}
        </p>
      </ScoutBox>
    );
  }

  const bands = [
    { label: "p25", value: s?.p25 },
    { label: "Median", value: s?.p50 ?? insight.headline?.median_salary },
    { label: "p75", value: s?.p75 },
    { label: "p90", value: s?.p90 },
  ];

  return (
    <>
      <ScoutBox stack padding="20px 24px" style={{ marginBottom: 12 }}>
        <ScoutLabel>Salary distribution</ScoutLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          {bands.map((b) => (
            <div key={b.label}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>{b.label}</p>
              <p style={{ ...displayTitleStyle(22, { margin: "4px 0 0" }) }}>
                {formatInsightsSalary(b.value, currency) ?? "—"}
              </p>
            </div>
          ))}
        </div>
        {s?.count != null && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "12px 0 0" }}>
            Based on {s.count.toLocaleString()} listings with disclosed salary.
          </p>
        )}
      </ScoutBox>

      {(insight.salary_by_level?.length ?? 0) > 0 && (
        <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
          <ScoutLabel>By experience level</ScoutLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {insight.salary_by_level!.map((row) => (
              <div
                key={row.key}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
              >
                <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                  {row.key}
                </span>
                <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.forest }}>
                  {formatSalaryRange(row.p25, row.p75, currency) ?? formatInsightsSalary(row.p50, currency) ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </ScoutBox>
      )}

      {(insight.salary_by_location_type?.length ?? 0) > 0 && (
        <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
          <ScoutLabel>By work arrangement</ScoutLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {insight.salary_by_location_type!.map((row) => (
              <div
                key={row.key}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
              >
                <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                  {row.key}
                </span>
                <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.forest }}>
                  {formatSalaryRange(row.p25, row.p75, currency) ?? formatInsightsSalary(row.p50, currency) ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </ScoutBox>
      )}
    </>
  );
}

export function TrendCompareRow({
  payload,
  shortDays,
  longDays,
}: {
  payload: MarketInsightsPayload;
  shortDays: number;
  longDays: number;
}) {
  const short = payload.windows[String(shortDays)]?.headline?.total_count;
  const long = payload.windows[String(longDays)]?.headline?.total_count;
  if (short == null || long == null) return null;
  const delta = short - long;
  const pct = long > 0 ? Math.round((delta / long) * 100) : null;
  const label = delta >= 0 ? "up" : "down";

  return (
    <ScoutBox padding="14px 18px" style={{ marginBottom: 16, borderColor: "rgba(26,58,47,0.2)" }}>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, margin: 0, lineHeight: 1.55 }}>
        <strong>{shortDays}-day</strong> window: {short.toLocaleString()} roles vs{" "}
        <strong>{longDays}-day</strong>: {long.toLocaleString()} ({label} {Math.abs(delta).toLocaleString()}
        {pct != null ? `, ${pct >= 0 ? "+" : ""}${pct}%` : ""} in the shorter window&apos;s share of activity).
      </p>
    </ScoutBox>
  );
}

export function ScoresGrid({ scores }: { scores: Record<string, number> | undefined }) {
  if (!scores || !Object.keys(scores).length) return null;
  const labels: Record<string, string> = {
    compensation_value_score: "Comp value",
    flexibility_score: "Flexibility",
    benefits_score: "Benefits",
    growth_score: "Growth",
    prestige_score: "Prestige",
    impact_autonomy_score: "Impact",
    coolness_score: "Appeal",
  };

  return (
    <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
      <ScoutLabel>Market quality scores (0–10)</ScoutLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginTop: 10 }}>
        {Object.entries(scores).map(([key, val]) => (
          <div key={key} style={{ background: surface.inset, border: border.line, padding: "10px 12px" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
              {labels[key] ?? key.replace(/_/g, " ")}
            </p>
            <p style={{ ...displayTitleStyle(20, { margin: "4px 0 0" }) }}>{val.toFixed(1)}</p>
          </div>
        ))}
      </div>
    </ScoutBox>
  );
}
