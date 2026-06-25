"use client";

import Link from "next/link";
import type { MarketTrendsWindow, InsightsKeyCount } from "@/lib/market-trends-types";
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
      {!configured && (
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
  insight: MarketTrendsWindow;
  isMobile?: boolean;
}) {
  const h = insight.headline;
  const items = [
    { label: "Active roles", value: h?.total_count?.toLocaleString() ?? "—" },
    { label: "Sample size", value: h?.sample_size?.toLocaleString() ?? "—" },
    { label: "New this week", value: h?.new_this_week?.toLocaleString() ?? "—" },
    {
      label: "AI / automation",
      value: h?.pct_ai_related != null ? `${Math.round(h.pct_ai_related)}%` : "—",
    },
    { label: "Remote", value: h?.pct_remote != null ? `${Math.round(h.pct_remote)}%` : "—" },
    { label: "Top tech", value: h?.top_technology ?? "—" },
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
}: {
  insight: MarketTrendsWindow;
  dataSource?: "sumble" | "none";
}) {
  const h = insight.headline;
  return (
    <ScoutBox padding="20px 22px">
      <ScoutLabel>Salary</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "10px 0 0", lineHeight: 1.55 }}>
        Kimchi does not use Hirebase Insights for salary bands. Sumble job samples also omit comp data.
        Use skills, technologies, and initiatives from job posts for market trends instead.
      </p>
      {h?.dominant_experience_level && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.stone, margin: "10px 0 0" }}>
          Most common level in sample: {h.dominant_experience_level}
        </p>
      )}
    </ScoutBox>
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
