"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { GrowingEmployersBundle, MarketProjectsBundle, MarketSignalsBundle } from "@/lib/sumble-market-extended";
import { formatSumbleGrowth } from "@/lib/sumble";
import { MarketShell } from "@/components/scout/market-shell";
import {
  InsightsEmpty,
  SumbleLoadPrompt,
} from "@/components/scout/market-analytics-ui";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { fontSans, fontMono, color, border, type as T } from "@/lib/typography";

type Tab = "signals" | "projects" | "growing";

function formatSignalDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function TabButton({ active, label, onClick, isMobile }: { active: boolean; label: string; onClick: () => void; isMobile?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: fontSans,
        fontSize: T.caption,
        fontWeight: 600,
        padding: isMobile ? "10px 14px" : "8px 14px",
        minHeight: isMobile ? 44 : undefined,
        cursor: "pointer",
        background: active ? color.forest : "transparent",
        color: active ? "#fff" : color.muted,
        border: border.line,
      }}
    >
      {label}
    </button>
  );
}

export function MarketSignalsPage() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>("signals");

  const [signalsData, setSignalsData] = useState<MarketSignalsBundle | null>(null);
  const [projectsData, setProjectsData] = useState<MarketProjectsBundle | null>(null);
  const [growingData, setGrowingData] = useState<GrowingEmployersBundle | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresLoad, setRequiresLoad] = useState(true);

  const probe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        tab === "signals"
          ? "/api/market/signals"
          : tab === "projects"
            ? "/api/market/projects"
            : "/api/market/growing-employers";
      const res = await fetch(endpoint);
      const body = await res.json();
      if (tab === "signals") {
        const b = body as MarketSignalsBundle;
        setSignalsData(b);
        setRequiresLoad(b.requiresLoad ?? !b.signals.length);
      } else if (tab === "projects") {
        const b = body as MarketProjectsBundle;
        setProjectsData(b);
        setRequiresLoad(b.requiresLoad ?? !b.projects.length);
      } else {
        const b = body as GrowingEmployersBundle;
        setGrowingData(b);
        setRequiresLoad(b.requiresLoad ?? !b.organizations.length);
      }
      if (!res.ok && body.error) setError(body.error);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const load = useCallback(
    async (refresh?: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const endpoint =
          tab === "signals"
            ? "/api/market/signals"
            : tab === "projects"
              ? "/api/market/projects"
              : "/api/market/growing-employers";
        const params = new URLSearchParams({ load: "1" });
        if (refresh) params.set("refresh", "1");
        const res = await fetch(`${endpoint}?${params}`);
        const body = await res.json();
        if (tab === "signals") {
          const b = body as MarketSignalsBundle;
          setSignalsData(b);
          setRequiresLoad(false);
          if (b.error) setError(b.error);
        } else if (tab === "projects") {
          const b = body as MarketProjectsBundle;
          setProjectsData(b);
          setRequiresLoad(false);
          if (b.error) setError(b.error);
        } else {
          const b = body as GrowingEmployersBundle;
          setGrowingData(b);
          setRequiresLoad(false);
          if (b.error) setError(b.error);
        }
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    },
    [tab]
  );

  useEffect(() => {
    setRequiresLoad(true);
    setError(null);
    void probe();
  }, [probe]);

  const estimatedCredits =
    tab === "signals"
      ? signalsData?.estimatedCredits ?? 8
      : tab === "projects"
        ? projectsData?.estimatedCredits ?? 15
        : growingData?.estimatedCredits ?? 15;

  const creditsRemaining =
    signalsData?.creditsRemaining ?? projectsData?.creditsRemaining ?? growingData?.creditsRemaining;

  const hasContent =
    (tab === "signals" && (signalsData?.signals.length ?? 0) > 0) ||
    (tab === "projects" && (projectsData?.projects.length ?? 0) > 0) ||
    (tab === "growing" && (growingData?.organizations.length ?? 0) > 0);

  return (
    <MarketShell
      title="Signals & trends"
      subtitle="Global Sumble signals, active projects, and fastest-growing employers — load on demand."
      toolbar={
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <TabButton active={tab === "signals"} label="Signals" onClick={() => setTab("signals")} isMobile={isMobile} />
          <TabButton active={tab === "projects"} label="Projects" onClick={() => setTab("projects")} isMobile={isMobile} />
          <TabButton active={tab === "growing"} label="Growing employers" onClick={() => setTab("growing")} isMobile={isMobile} />
        </div>
      }
    >
      {requiresLoad && !hasContent && !error && (
        <SumbleLoadPrompt
          title={tab === "signals" ? "Market signals" : tab === "projects" ? "Active projects" : "Fastest-growing employers"}
          description={
            tab === "signals"
              ? "Search Sumble signals for your target job functions."
              : tab === "projects"
                ? "Sample recent job postings and aggregate project mentions."
                : "Organizations with the highest YoY hiring growth for your roles."
          }
          estimatedCredits={estimatedCredits}
          creditsRemaining={creditsRemaining}
          loading={loading}
          onLoad={() => void load()}
        />
      )}

      {!requiresLoad && hasContent && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <ScoutSecondaryBtn onClick={() => void load(true)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </ScoutSecondaryBtn>
        </div>
      )}

      {loading && !hasContent && (
        <ScoutBox padding="20px 22px">
          <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.forest, margin: 0 }}>Loading…</p>
        </ScoutBox>
      )}

      {error && !hasContent && <InsightsEmpty message={error} configured />}

      {tab === "signals" && signalsData && signalsData.signals.length > 0 && (
        <ScoutBox padding="12px 16px">
          <ScoutLabel>Signals · {signalsData.jobFunctionTerms.join(", ")}</ScoutLabel>
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
            {signalsData.signals.map((signal, i) => (
              <li key={`${signal.date}-${signal.title}-${i}`} style={{ padding: "12px 0", borderBottom: border.line }}>
                <div style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.stone }}>{signal.title}</div>
                {signal.subtitle && (
                  <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 4 }}>{signal.subtitle}</div>
                )}
                {signal.organization_name && (
                  <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, marginTop: 4 }}>{signal.organization_name}</div>
                )}
                <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, marginTop: 6 }}>
                  {formatSignalDate(signal.date)}
                  {signal.display_type ? ` · ${signal.display_type}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </ScoutBox>
      )}

      {tab === "projects" && projectsData && projectsData.projects.length > 0 && (
        <ScoutBox padding="12px 16px">
          <ScoutLabel>Projects · {projectsData.jobFunctionTerm}</ScoutLabel>
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
            {projectsData.projects.map((project) => (
              <li key={project.slug} style={{ padding: "10px 0", borderBottom: border.line }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.stone }}>{project.name}</span>
                  <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>{project.jobCount} postings</span>
                </div>
                {project.goal && (
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>{project.goal}</p>
                )}
              </li>
            ))}
          </ul>
        </ScoutBox>
      )}

      {tab === "growing" && growingData && growingData.organizations.length > 0 && (
        <ScoutBox padding="12px 16px">
          <ScoutLabel>Fastest growing · {growingData.jobFunctionTerm}</ScoutLabel>
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
            {growingData.organizations.map((org) => (
              <li key={org.name} style={{ padding: "10px 0", borderBottom: border.line }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                  {org.sumbleUrl ? (
                    <a href={org.sumbleUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, textDecoration: "none" }}>
                      {org.name} ↗
                    </a>
                  ) : (
                    <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.stone }}>{org.name}</span>
                  )}
                  <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.forest }}>
                    {formatSumbleGrowth(org.growth1y) ?? "—"} · {org.jobPostCount} roles
                  </span>
                </div>
                {org.domain && (
                  <div style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 4 }}>{org.domain}</div>
                )}
              </li>
            ))}
          </ul>
        </ScoutBox>
      )}
    </MarketShell>
  );
}
