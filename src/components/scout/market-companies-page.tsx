"use client";

import { useState } from "react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMarketInsights, windowInsight } from "@/hooks/useMarketInsights";
import { MarketShell } from "@/components/scout/market-shell";
import { CompanyLogo } from "@/components/scout/company-logo";
import {
  InsightsEmpty,
  InsightsMetaRow,
  SumbleLoadPrompt,
  WindowPicker,
} from "@/components/scout/market-analytics-ui";
import { ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { fontSans, fontMono, color, surface, border, type as T } from "@/lib/typography";

export function MarketCompaniesPage() {
  const [days, setDays] = useState(30);
  const isMobile = useIsMobile();
  const { data, loading, error, refresh, load, requiresLoad } = useMarketInsights(days, "7,30,90,180");
  const insight = windowInsight(data, days);
  const companies = insight?.top_companies ?? [];

  return (
    <MarketShell
      title="Top employers"
      subtitle="Companies hiring your target roles — load on demand to conserve Sumble credits."
      toolbar={<WindowPicker value={days} onChange={setDays} isMobile={isMobile} />}
    >
      {requiresLoad && !insight && !error && (
        <SumbleLoadPrompt
          title="Top employers"
          description="Pull a small job sample to rank employers hiring your target roles."
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
            Loading employer rankings…
          </p>
        </ScoutBox>
      )}

      {!loading && error && !insight && (
        <InsightsEmpty message={error} configured={data?.configured} />
      )}

      {companies.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {companies.slice(0, 25).map((co, idx) => (
            <ScoutBox
              key={co.company_slug}
              padding={isMobile ? "14px 16px" : "16px 20px"}
              style={{ display: "flex", alignItems: "center", gap: 14 }}
            >
              <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, width: 24, flexShrink: 0 }}>
                {idx + 1}
              </span>
              <CompanyLogo name={co.company_name} logoUrl={co.company_logo ?? null} size={36} borderRadius={0} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, margin: 0 }}>
                  {co.company_name}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "4px 0 0" }}>
                  {co.count.toLocaleString()} matching roles
                  {co.percent != null ? ` · ${co.percent.toFixed(1)}% of cohort` : ""}
                </p>
              </div>
              <Link
                href={`/opportunities/companies?intel=${encodeURIComponent(co.company_slug)}&name=${encodeURIComponent(co.company_name)}`}
                style={{
                  flexShrink: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  color: color.forest,
                  textDecoration: "none",
                  padding: isMobile ? "10px 12px" : "6px 12px",
                  border: border.line,
                  background: surface.inset,
                  minHeight: isMobile ? 44 : undefined,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Intel →
              </Link>
            </ScoutBox>
          ))}
        </div>
      )}

      {insight && companies.length === 0 && (
        <ScoutBox padding="20px 22px">
          <ScoutLabel>No ranked employers</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0" }}>
            Try widening the time window or updating target roles in Profile.
          </p>
        </ScoutBox>
      )}
    </MarketShell>
  );
}
