"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMarketInsights, windowInsight } from "@/hooks/useMarketInsights";
import { MarketShell } from "@/components/scout/market-shell";
import {
  InsightsEmpty,
  InsightsMetaRow,
  RankList,
  WindowPicker,
} from "@/components/scout/market-analytics-ui";
import { ScoutBox } from "@/components/scout/scout-box";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";

export function MarketSkillsPage() {
  const [days, setDays] = useState(30);
  const isMobile = useIsMobile();
  const { data, loading, error, refresh } = useMarketInsights(days, "7,30,90,180");
  const insight = windowInsight(data, days);

  return (
    <MarketShell
      title="Skills & stack"
      subtitle="Technologies and skills employers ask for most in your target market."
      toolbar={<WindowPicker value={days} onChange={setDays} isMobile={isMobile} />}
    >
      <InsightsMetaRow payload={data} onRefresh={refresh} loading={loading} />

      {loading && !insight && (
        <ScoutBox padding="20px 22px">
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.forest, margin: 0 }}>
            Loading skills data…
          </p>
        </ScoutBox>
      )}

      {!loading && error && !insight && (
        <InsightsEmpty message={error} configured={data?.configured} />
      )}

      {insight && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <RankList title="Skills in demand" items={insight.top_skills ?? []} />
            <RankList title="Technologies" items={insight.top_technologies ?? []} />
          </div>

          <ScoutBox padding="18px 20px" style={{ marginTop: 4 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Common benefits
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(insight.top_benefits ?? []).slice(0, 16).map((b) => (
                <span
                  key={b.key}
                  style={{
                    padding: "4px 12px",
                    background: surface.inset,
                    border: border.line,
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    color: color.forest,
                  }}
                >
                  {b.key}
                </span>
              ))}
            </div>
          </ScoutBox>

          <RankList title="Education requirements" items={insight.education_split ?? []} />
        </>
      )}
    </MarketShell>
  );
}
