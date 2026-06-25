"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MarketInsightsPayload } from "@/hooks/useMarketInsights";
import { windowInsight } from "@/hooks/useMarketInsights";
import { SumbleLoadPrompt } from "@/components/scout/market-analytics-ui";
import { ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { RefreshIcon } from "./workspace-icons";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

export function DashboardMarketTrendsPanel({ isMobile }: { isMobile?: boolean }) {
  const [data, setData] = useState<MarketInsightsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresLoad, setRequiresLoad] = useState(true);

  const load = useCallback(async (options?: { refresh?: boolean; fetch?: boolean }) => {
    const refresh = options?.refresh ?? false;
    const shouldFetch = options?.fetch ?? refresh;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: "30", windows: "7,30,90" });
      if (shouldFetch) params.set("load", "1");
      if (refresh) params.set("refresh", "1");
      const res = await fetch(`/api/market/insights?${params}`);
      const body = (await res.json()) as MarketInsightsPayload;
      setData(body);
      setRequiresLoad(body.requiresLoad ?? !Object.keys(body.windows ?? {}).length);
      if (!res.ok && !Object.keys(body.windows ?? {}).length && !body.requiresLoad) {
        setError(body.error ?? "Market trends unavailable.");
      } else if (body.error && !Object.keys(body.windows ?? {}).length) {
        setError(body.error);
      } else {
        setError(body.error ?? null);
      }
    } catch {
      setError("Could not load job market trends.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load({ fetch: false });
  }, [load]);

  const insight = windowInsight(data, 30);
  const hasData = !!insight;

  const aiPct = insight?.headline?.pct_ai_related;
  const topTech = insight?.top_technologies?.[0];
  const topProject = insight?.top_projects?.[0];
  const sampleSize = data?.jobSampleSize ?? insight?.headline?.sample_size ?? 50;

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
        <ScoutLabel>Job market trends</ScoutLabel>
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
          <RefreshIcon /> {requiresLoad ? "Load trends" : "Refresh"}
        </button>
      </div>

      {requiresLoad && !hasData && !loading && !error && (
        <SumbleLoadPrompt
          title="Job market trends"
          description={`Analyze ~${sampleSize} recent job postings for your target roles via Sumble. Surfaces technologies, initiatives, experience levels, and AI/automation themes. Cached 24 hours.`}
          estimatedCredits={data?.estimatedCredits ?? 25}
          creditsRemaining={data?.creditsRemaining}
          loading={loading}
          onLoad={() => void load({ fetch: true })}
          loadLabel="Load market trends"
        />
      )}

      {loading && !hasData && !requiresLoad && (
        <ScoutBox padding="14px 18px">
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.forest, margin: 0 }}>
            Analyzing job postings…
          </p>
        </ScoutBox>
      )}

      {error && !hasData && (
        <ScoutBox padding="14px 18px">
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.5 }}>{error}</p>
        </ScoutBox>
      )}

      {hasData && insight && data && (
        <>
          <ScoutBox stack padding={isMobile ? "16px 18px" : "18px 22px"} style={{ marginBottom: 12 }}>
            <ScoutLabel>Trend read · {data.roleLabel}</ScoutLabel>
            <p style={displayTitleStyle(isMobile ? 20 : 24, { margin: "10px 0 0", color: color.ink })}>
              {data.headline || data.roleLabel}
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
              Based on {sampleSize} recent postings · market size{" "}
              {insight.headline?.total_count?.toLocaleString() ?? "—"} roles
              {data.generatedAt && (
                <>
                  {" · "}
                  Updated{" "}
                  {new Date(data.generatedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </>
              )}
            </p>
          </ScoutBox>

          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              paddingBottom: 4,
              marginLeft: isMobile ? -16 : 0,
              marginRight: isMobile ? -16 : 0,
              paddingLeft: isMobile ? 16 : 0,
              paddingRight: isMobile ? 16 : 0,
              scrollbarWidth: "none",
            }}
          >
            {[
              {
                label: "Demand",
                title: `${insight.headline?.total_count?.toLocaleString() ?? "—"} active roles`,
                sub: `${insight.headline?.new_this_week ?? 0} new in sample this week`,
              },
              {
                label: "AI & automation",
                title:
                  aiPct != null && aiPct > 0
                    ? `${Math.round(aiPct)}% of postings mention AI`
                    : "No AI theme in sample yet",
                sub:
                  insight.headline?.ai_related_count != null
                    ? `${insight.headline.ai_related_count} of ${sampleSize} postings`
                    : "Load refresh after target role changes",
              },
              {
                label: "Top technology",
                title: topTech?.key ?? "—",
                sub: topTech ? `${topTech.count} mentions in sample` : "Technologies from job posts",
              },
              {
                label: "Hot initiative",
                title: topProject?.name ?? insight.headline?.top_technology ?? "—",
                sub: topProject?.goal ?? "Projects/initiatives employers cite",
              },
            ].map((card) => (
              <ScoutBox
                key={card.label}
                padding="18px 20px"
                style={{ flex: "none", width: isMobile ? "min(85vw, 272px)" : 272 }}
              >
                <span
                  style={{
                    padding: "2px 8px",
                    background: surface.inset,
                    border: border.line,
                    fontFamily: fontMono,
                    fontSize: T.caption,
                    fontWeight: 700,
                    color: color.forest,
                    textTransform: "uppercase",
                  }}
                >
                  {card.label}
                </span>
                <p style={displayTitleStyle(isMobile ? 17 : 19, { margin: "10px 0 6px", lineHeight: 1.35 })}>
                  {card.title}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.5 }}>
                  {card.sub}
                </p>
              </ScoutBox>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
              marginTop: 16,
            }}
          >
            <ScoutBox padding={isMobile ? "18px 20px" : "22px 24px"}>
              <ScoutLabel>Skills & stack in demand</ScoutLabel>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 10px" }}>
                Tap to add to Upskilling.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {(insight.top_skills ?? []).slice(0, 8).map((s) => (
                  <Link
                    key={s.key}
                    href={`/profile/learning-path?skill=${encodeURIComponent(s.key)}`}
                    style={{
                      padding: "4px 12px",
                      background: surface.inset,
                      border: border.line,
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      fontWeight: 500,
                      color: color.forest,
                      textDecoration: "none",
                    }}
                  >
                    + {s.key}
                  </Link>
                ))}
              </div>
              {(insight.ai_technologies ?? []).length > 0 && (
                <>
                  <ScoutLabel>AI-related stack</ScoutLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {(insight.ai_technologies ?? []).slice(0, 6).map((s) => (
                      <Link
                        key={s.key}
                        href={`/profile/learning-path?skill=${encodeURIComponent(s.key)}`}
                        style={{
                          padding: "4px 12px",
                          background: "rgba(26,58,47,0.08)",
                          border: border.line,
                          fontFamily: fontSans,
                          fontSize: T.caption,
                          color: color.forest,
                          textDecoration: "none",
                        }}
                      >
                        {s.key}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </ScoutBox>

            <ScoutBox padding={isMobile ? "18px 20px" : "22px 24px"}>
              <ScoutLabel>Emerging initiatives</ScoutLabel>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 10px" }}>
                Projects and themes repeated across job posts.
              </p>
              {(insight.top_projects ?? []).length === 0 ? (
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                  No project tags in this sample — try refreshing or broaden target roles.
                </p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {(insight.top_projects ?? []).slice(0, 5).map((p) => (
                    <li key={p.key} style={{ padding: "10px 0", borderBottom: border.line }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                          {p.name}
                        </span>
                        <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                          {p.count} posts
                        </span>
                      </div>
                      {p.goal && (
                        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
                          {p.goal}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {(insight.level_breakdown ?? []).length > 0 && (
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.stone, margin: "14px 0 0", lineHeight: 1.5 }}>
                  Most common level: <strong>{insight.level_breakdown?.[0]?.key}</strong>
                  {insight.headline?.pct_remote != null ? ` · ${Math.round(insight.headline.pct_remote)}% remote` : ""}
                </p>
              )}
            </ScoutBox>
          </div>

          {(insight.top_companies ?? []).length > 0 && (
            <ScoutBox padding="16px 18px" style={{ marginTop: 12 }}>
              <ScoutLabel>Hiring in sample</ScoutLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {(insight.top_companies ?? []).slice(0, 6).map((co) => (
                  <Link
                    key={co.company_slug}
                    href="/opportunities/companies"
                    style={{
                      padding: "6px 12px",
                      border: border.line,
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      color: color.forest,
                      textDecoration: "none",
                    }}
                  >
                    {co.company_name} · {co.count}
                  </Link>
                ))}
              </div>
            </ScoutBox>
          )}
        </>
      )}
    </div>
  );
}
