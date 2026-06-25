"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMarketInsights, windowInsight } from "@/hooks/useMarketInsights";
import { MarketShell } from "@/components/scout/market-shell";
import {
  InsightsEmpty,
  InsightsMetaRow,
  KpiGrid,
  RankList,
  SplitBars,
  SumbleLoadPrompt,
  TrendCompareRow,
  WindowPicker,
  ScoresGrid,
} from "@/components/scout/market-analytics-ui";
import { ScoutBox, ScoutDisplayTitle } from "@/components/scout/scout-box";
import { displayTitleStyle, fontSans, color, type as T } from "@/lib/typography";

export function MarketOverviewPage() {
  const [days, setDays] = useState(30);
  const isMobile = useIsMobile();
  const { data, loading, error, refresh, load, requiresLoad } = useMarketInsights(days, "7,30,90,180");
  const insight = windowInsight(data, days);

  return (
    <MarketShell
      title="Market overview"
      subtitle="Hiring analytics for your target roles — load on demand to conserve Sumble credits."
      toolbar={<WindowPicker value={days} onChange={setDays} isMobile={isMobile} />}
    >
      {requiresLoad && !insight && !error && (
        <SumbleLoadPrompt
          title="Market overview"
          description="Pull a small job sample from Sumble for your target roles. Nothing loads automatically."
          estimatedCredits={data?.estimatedCredits ?? 25}
          creditsRemaining={data?.creditsRemaining}
          loading={loading}
          onLoad={load}
        />
      )}

      {!requiresLoad && <InsightsMetaRow payload={data} onRefresh={refresh} loading={loading} />}

      {loading && !insight && (
        <ScoutBox padding="20px 22px">
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.forest, margin: 0 }}>
            Loading market intelligence…
          </p>
        </ScoutBox>
      )}

      {!loading && error && !insight && (
        <InsightsEmpty message={error} configured={data?.configured} />
      )}

      {insight && data && (
        <>
          <ScoutBox stack padding={isMobile ? "16px 18px" : "18px 22px"} style={{ marginBottom: 16 }}>
            <ScoutDisplayTitle size={isMobile ? 20 : 24}>{data.headline || data.roleLabel}</ScoutDisplayTitle>
          </ScoutBox>

          <TrendCompareRow payload={data} shortDays={7} longDays={30} />

          <KpiGrid insight={insight} isMobile={isMobile} />

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <SplitBars title="Experience level mix" items={insight.level_breakdown ?? []} />
            <SplitBars title="Work arrangement" items={insight.location_type_split ?? []} />
            <SplitBars title="Company size" items={insight.company_size_split ?? []} />
            <SplitBars title="Top industries" items={insight.industry_split ?? []} />
          </div>

          <RankList title="Top locations" items={(insight.top_locations ?? []).map((l) => ({
            key: [l.label, l.region, l.country].filter(Boolean).join(", "),
            count: l.count,
            percent: l.percent,
          }))} />

          <ScoresGrid scores={insight.scores} />

          {(insight.visa_sponsorship_rate != null || insight.yoe_median != null) && (
            <ScoutBox padding="16px 18px" style={{ marginTop: 4 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: 0, lineHeight: 1.6 }}>
                {insight.visa_sponsorship_rate != null &&
                  `${Math.round(insight.visa_sponsorship_rate)}% offer visa sponsorship. `}
                {insight.yoe_median != null && `Median experience required: ${insight.yoe_median} years.`}
              </p>
            </ScoutBox>
          )}
        </>
      )}
    </MarketShell>
  );
}
