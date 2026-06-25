"use client";

import { useCallback, useEffect, useState } from "react";
import type { HirebaseInsightsResponse } from "@/lib/hirebase-insights";
import { formatInsightsSalary } from "@/lib/hirebase-insights";
import {
  KpiGrid,
  RankList,
  SalaryDeepDive,
  SplitBars,
  TrendCompareRow,
  WindowPicker,
} from "@/components/scout/market-analytics-ui";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, color, type as T } from "@/lib/typography";
import type { MarketInsightsPayload } from "@/hooks/useMarketInsights";

type CompanyIntelPayload = {
  configured: boolean;
  companyName: string;
  companySlug: string;
  targetRoles: string[];
  windows: Record<string, HirebaseInsightsResponse>;
  primaryDays: number;
  generatedAt: string | null;
  error?: string;
};

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
        });
        if (trackedId) params.set("trackedId", trackedId);
        if (slugHint) params.set("slug", slugHint);
        if (refresh) params.set("refresh", "1");
        const res = await fetch(`/api/companies/hirebase-intel?${params}`);
        const body = (await res.json()) as CompanyIntelPayload;
        setData(body);
        if (!res.ok || body.error) setError(body.error ?? "Could not load Hirebase analytics.");
      } catch {
        setError("Network error loading company analytics.");
      } finally {
        setLoading(false);
      }
    },
    [days, trackedId, companyName, slugHint]
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
        serverCached: false,
      }
    : null;

  if (loading && !insight) {
    return (
      <ScoutBox padding="14px 16px">
        <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.forest, margin: 0 }}>
          Loading Hirebase analytics…
        </p>
      </ScoutBox>
    );
  }

  if (error && !insight) {
    return (
      <ScoutBox padding="14px 16px">
        <ScoutLabel>Hirebase analytics</ScoutLabel>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
          {error}
        </p>
      </ScoutBox>
    );
  }

  if (!insight) return null;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div>
          <ScoutLabel>Hirebase analytics</ScoutLabel>
          {data?.companySlug && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "4px 0 0" }}>
              {data.companySlug}
              {data.generatedAt
                ? ` · ${new Date(data.generatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </p>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <WindowPicker value={days} onChange={setDays} />
          <ScoutSecondaryBtn onClick={() => load(true)} disabled={loading} style={{ minHeight: 36 }}>
            Refresh
          </ScoutSecondaryBtn>
        </div>
      </div>

      {trendPayload && <TrendCompareRow payload={trendPayload} shortDays={7} longDays={30} />}

      <KpiGrid insight={insight} isMobile={compact} />

      {!compact && (
        <>
          <SalaryDeepDive insight={insight} />
          <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 12 }}>
            <RankList title="Skills at this company" items={insight.top_skills ?? []} />
            <RankList title="Technologies" items={insight.top_technologies ?? []} />
            <SplitBars title="Level mix" items={insight.level_breakdown ?? []} />
            <SplitBars title="Work arrangement" items={insight.location_type_split ?? []} />
          </div>
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

      {compact && (insight.top_skills?.length ?? 0) > 0 && (
        <ScoutBox padding="12px 14px" style={{ marginTop: 8 }}>
          <ScoutLabel>Top skills</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, margin: "8px 0 0", lineHeight: 1.6 }}>
            {insight.top_skills!.slice(0, 6).map((s) => s.key).join(" · ")}
          </p>
        </ScoutBox>
      )}

      {!compact && insight.salary?.p50 != null && (
        <ScoutBox padding="12px 14px" style={{ marginTop: 8 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
            Role filter: {data?.targetRoles.join(", ") || "all roles at company"}
          </p>
        </ScoutBox>
      )}
    </div>
  );
}
