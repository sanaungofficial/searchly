"use client";

import { useCallback, useEffect, useState } from "react";
import type { HirebaseInsightsResponse, InsightsTopLocation } from "@/lib/hirebase-insights";
import { formatInsightsSalary } from "@/lib/hirebase-insights";
import {
  KpiGrid,
  RankList,
  SalaryDeepDive,
  ScoresGrid,
  SplitBars,
  TrendCompareRow,
  WindowPicker,
} from "@/components/scout/market-analytics-ui";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "./scout-box";
import { IntelRefreshButton } from "@/components/scout/intel-refresh-button";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { fontSans, fontMono, color, surface, border, type as T } from "@/lib/typography";
import type { MarketInsightsPayload } from "@/hooks/useMarketInsights";

type CompanyIntelPayload = {
  configured: boolean;
  companyName: string;
  companySlug: string;
  targetRoles: string[];
  roleFilter: "matched" | "all";
  windows: Record<string, HirebaseInsightsResponse>;
  primaryDays: number;
  generatedAt: string | null;
  serverCached?: boolean;
  error?: string;
};

function LocationRankList({ title, items }: { title: string; items: InsightsTopLocation[] }) {
  if (!items.length) return null;
  return (
    <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
      <ScoutLabel>{title}</ScoutLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {items.slice(0, 12).map((item) => (
          <div
            key={`${item.label}-${item.region ?? ""}-${item.country ?? ""}`}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
          >
            <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, fontWeight: 500 }}>
              {item.label}
              {item.region || item.country
                ? ` · ${[item.region, item.country].filter(Boolean).join(", ")}`
                : ""}
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

function RateChips({ insight }: { insight: HirebaseInsightsResponse }) {
  const chips: { label: string; value: string }[] = [];
  const h = insight.headline;

  if (h?.sample_size != null) chips.push({ label: "Sample size", value: h.sample_size.toLocaleString() });
  if (h?.pct_disclosing_salary != null) {
    chips.push({ label: "Disclosing salary", value: `${Math.round(h.pct_disclosing_salary)}%` });
  }
  if (h?.top_company) chips.push({ label: "Top company (cohort)", value: h.top_company });
  if (insight.visa_sponsorship_rate != null) {
    const v = insight.visa_sponsorship_rate;
    chips.push({
      label: "Visa sponsorship",
      value: v <= 1 ? `${Math.round(v * 100)}%` : `${Math.round(v)}%`,
    });
  }
  if (insight.recruiter_agency_rate != null) {
    const v = insight.recruiter_agency_rate;
    chips.push({
      label: "Recruiter agency",
      value: v <= 1 ? `${Math.round(v * 100)}%` : `${Math.round(v)}%`,
    });
  }
  if (insight.yoe_median != null) chips.push({ label: "Median YoE", value: `${insight.yoe_median} yrs` });

  if (!chips.length) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {chips.map((chip) => (
        <ScoutBox key={chip.label} padding="10px 12px">
          <ScoutLabel>{chip.label}</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "4px 0 0" }}>
            {chip.value}
          </p>
        </ScoutBox>
      ))}
    </div>
  );
}

function SalaryHistogram({ insight }: { insight: HirebaseInsightsResponse }) {
  const histogram = insight.salary?.histogram;
  if (!histogram?.length) return null;
  const max = Math.max(...histogram.map((b) => b.count), 1);
  const currency = insight.salary?.currency ?? insight.headline?.salary_currency ?? "USD";

  return (
    <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
      <ScoutLabel>Salary histogram</ScoutLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {histogram.slice(0, 12).map((bin) => (
          <div key={`${bin.lower}-${bin.upper}`}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                {formatInsightsSalary(bin.lower, currency) ?? bin.lower}–
                {formatInsightsSalary(bin.upper, currency) ?? bin.upper}
              </span>
              <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>{bin.count}</span>
            </div>
            <div style={{ height: 6, background: surface.inset, border: border.line }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round((bin.count / max) * 100)}%`,
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

function FreshnessBlock({ freshness }: { freshness: Record<string, unknown> }) {
  const entries = Object.entries(freshness).filter(([, v]) => v != null && v !== "");
  if (!entries.length) return null;

  return (
    <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
      <ScoutLabel>Posting freshness</ScoutLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        {entries.map(([key, value]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink }}>{key.replace(/_/g, " ")}</span>
            <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
              {typeof value === "number" ? value.toLocaleString() : String(value)}
            </span>
          </div>
        ))}
      </div>
    </ScoutBox>
  );
}

function ScoresByLevelBlock({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return null;
  return (
    <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
      <ScoutLabel>Scores by level</ScoutLabel>
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
          maxHeight: 240,
          overflow: "auto",
        }}
      >
        {JSON.stringify(rows, null, 2)}
      </pre>
    </ScoutBox>
  );
}

function RawResponseExplorer({ insight }: { insight: HirebaseInsightsResponse }) {
  const [open, setOpen] = useState(false);
  return (
    <ScoutBox padding="14px 16px" style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          fontFamily: fontSans,
          fontSize: T.bodySm,
          fontWeight: 600,
          color: color.forest,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {open ? "Hide" : "Show"} full API response (JSON)
      </button>
      {open && (
        <pre
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            color: color.stone,
            margin: "12px 0 0",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: surface.inset,
            border: border.line,
            padding: 12,
            maxHeight: 420,
            overflow: "auto",
          }}
        >
          {JSON.stringify(insight, null, 2)}
        </pre>
      )}
    </ScoutBox>
  );
}

export function CompanyHirebaseIntelPanel({
  trackedId,
  companyName,
  slugHint,
  compact,
}: {
  trackedId?: string;
  companyName: string;
  slugHint?: string | null;
  compact?: boolean;
}) {
  const [days, setDays] = useState(30);
  const [roleFilter, setRoleFilter] = useState<"matched" | "all">("matched");
  const [data, setData] = useState<CompanyIntelPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          days: String(days),
          windows: "7,30,90",
          name: companyName,
          roleFilter,
        });
        if (trackedId) params.set("trackedId", trackedId);
        if (slugHint) params.set("slug", slugHint);
        if (refresh) params.set("refresh", "1");
        const res = await fetch(`/api/companies/hirebase-intel?${params}`);
        const body = (await res.json()) as CompanyIntelPayload;
        setData(body);
        if (!res.ok || body.error) setError(body.error ?? "Could not load company insights.");
      } catch {
        setError("Network error loading company insights.");
      } finally {
        setLoading(false);
      }
    },
    [days, trackedId, companyName, slugHint, roleFilter]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const insight = data?.windows[String(days)] ?? null;
  const trendPayload: MarketInsightsPayload | null = data
    ? {
        configured: data.configured,
        targetRoles: data.targetRoles,
        roleLabel: data.companyName,
        windows: data.windows,
        primaryDays: days,
        headline: "",
        generatedAt: data.generatedAt,
        hirebaseCached: false,
        serverCached: data.serverCached ?? false,
      }
    : null;

  if (loading && !insight) {
    return (
      <ScoutBox padding="14px 16px">
        <KimchiProcessLoader preset="marketIntel" title="Loading Hirebase company insights…" variant="inline" />
      </ScoutBox>
    );
  }

  if (error && !insight) {
    return (
      <ScoutBox padding="14px 16px">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <IntelRefreshButton onClick={() => void load(true)} disabled={loading} />
        </div>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.5 }}>
          {error}
        </p>
      </ScoutBox>
    );
  }

  if (!insight) return null;

  const roleFilterLabel =
    data?.roleFilter === "all"
      ? "All roles at this company"
      : data?.targetRoles.length
        ? `Filtered: ${data.targetRoles.join(", ")}`
        : "Profile target roles";

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
          <ScoutLabel>Hirebase company insights</ScoutLabel>
          {data?.companySlug && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "4px 0 0" }}>
              slug: {data.companySlug}
              {data.generatedAt
                ? ` · ${new Date(data.generatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
              {data.serverCached ? " · cached" : ""}
            </p>
          )}
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, margin: "4px 0 0" }}>
            {roleFilterLabel}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <ScoutSecondaryBtn
              onClick={() => setRoleFilter("matched")}
              style={{
                minHeight: 36,
                padding: "6px 10px",
                fontWeight: roleFilter === "matched" ? 700 : 500,
                background: roleFilter === "matched" ? surface.inset : surface.card,
              }}
            >
              Target roles
            </ScoutSecondaryBtn>
            <ScoutSecondaryBtn
              onClick={() => setRoleFilter("all")}
              style={{
                minHeight: 36,
                padding: "6px 10px",
                fontWeight: roleFilter === "all" ? 700 : 500,
                background: roleFilter === "all" ? surface.inset : surface.card,
              }}
            >
              All roles
            </ScoutSecondaryBtn>
          </div>
          <WindowPicker value={days} onChange={setDays} />
          <IntelRefreshButton onClick={() => void load(true)} disabled={loading} />
        </div>
      </div>

      {trendPayload && <TrendCompareRow payload={trendPayload} shortDays={7} longDays={30} />}

      <KpiGrid insight={insight} isMobile={compact} />
      <RateChips insight={insight} />
      <ScoresGrid scores={insight.scores} />

      {!compact && (
        <>
          <SalaryDeepDive insight={insight} />
          <SalaryHistogram insight={insight} />

          <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 12 }}>
            <RankList title="Top skills" items={insight.top_skills ?? []} />
            <RankList title="Top technologies" items={insight.top_technologies ?? []} />
            <RankList title="Top benefits" items={insight.top_benefits ?? []} />
            <LocationRankList title="Top locations" items={insight.top_locations ?? []} />
            <SplitBars title="Level mix" items={insight.level_breakdown ?? []} />
            <SplitBars title="Work arrangement" items={insight.location_type_split ?? []} />
            <SplitBars title="Job type" items={insight.job_type_split ?? []} />
            <SplitBars title="Education" items={insight.education_split ?? []} />
            <SplitBars title="Industry" items={insight.industry_split ?? []} />
            <SplitBars title="Sub-industry" items={insight.subindustry_split ?? []} />
            <SplitBars title="Company size" items={insight.company_size_split ?? []} />
          </div>

          {(insight.top_companies?.length ?? 0) > 0 && (
            <ScoutBox stack padding="18px 20px" style={{ marginBottom: 12 }}>
              <ScoutLabel>Related employers in cohort</ScoutLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {insight.top_companies!.slice(0, 8).map((co) => (
                  <div key={co.company_slug} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                      {co.company_name}
                    </span>
                    <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                      {co.count.toLocaleString()}
                      {co.percent != null ? ` · ${co.percent.toFixed(1)}%` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </ScoutBox>
          )}

          {insight.freshness && typeof insight.freshness === "object" && (
            <FreshnessBlock freshness={insight.freshness as Record<string, unknown>} />
          )}

          {(insight.scores_by_level?.length ?? 0) > 0 && (
            <ScoresByLevelBlock rows={insight.scores_by_level!} />
          )}

          <RawResponseExplorer insight={insight} />
        </>
      )}

      {compact && insight.headline?.median_salary != null && (
        <ScoutBox padding="12px 14px">
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: 0 }}>
            Median{" "}
            {formatInsightsSalary(insight.headline.median_salary, insight.headline.salary_currency) ?? "—"}
            {insight.headline.new_this_week != null && ` · ${insight.headline.new_this_week} new this week`}
          </p>
        </ScoutBox>
      )}
    </div>
  );
}
