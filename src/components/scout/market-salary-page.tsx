"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMarketInsights, windowInsight } from "@/hooks/useMarketInsights";
import { MarketShell } from "@/components/scout/market-shell";
import {
  InsightsEmpty,
  InsightsMetaRow,
  SalaryDeepDive,
  SumbleLoadPrompt,
  WindowPicker,
} from "@/components/scout/market-analytics-ui";
import { ScoutBox } from "@/components/scout/scout-box";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { fontSans, color, type as T } from "@/lib/typography";

export function MarketSalaryPage() {
  const [days, setDays] = useState(30);
  const isMobile = useIsMobile();
  const { data, loading, error, refresh, load, requiresLoad } = useMarketInsights(days, "7,30,90,180");
  const insight = windowInsight(data, days);

  return (
    <MarketShell
      title="Salary explorer"
      subtitle="Comp bands by level and work arrangement — load on demand (Sumble has no salary bands yet)."
      toolbar={<WindowPicker value={days} onChange={setDays} isMobile={isMobile} />}
    >
      {requiresLoad && !insight && !error && (
        <SumbleLoadPrompt
          title="Salary explorer"
          description="Load market data first. Sumble listings do not include salary bands — other tabs have richer signals."
          estimatedCredits={data?.estimatedCredits ?? 25}
          creditsRemaining={data?.creditsRemaining}
          loading={loading}
          onLoad={load}
        />
      )}

      {!requiresLoad && <InsightsMetaRow payload={data} onRefresh={refresh} loading={loading} />}

      {loading && !insight && (
        <KimchiProcessLoader preset="marketIntel" title="Loading salary data…" variant="inline" />
      )}

      {!loading && error && !insight && (
        <InsightsEmpty message={error} configured={data?.configured} />
      )}

      {insight && <SalaryDeepDive insight={insight} dataSource={data?.dataSource} />}
    </MarketShell>
  );
}
