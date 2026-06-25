"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveSessionView } from "@/lib/live-session-types";
import { liveSessionRouteId } from "@/lib/live-sessions";
import { ScoutBox, ScoutPrimaryBtn } from "./scout-box";
import { WorkspacePageShell } from "./workspace-page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import { border, color, fontSans, type as T } from "@/lib/typography";

type LiveFilter = "all" | "mine" | "live" | "week";

type LiveSessionRow = LiveSessionView & { canHost: boolean };

function sessionRouteId(s: LiveSessionRow): string {
  return liveSessionRouteId(s);
}

export function WorkspaceLive() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<LiveFilter>("all");
  const [sessions, setSessions] = useState<LiveSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hostSessionCount, setHostSessionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/live/sessions");
      if (!res.ok) throw new Error("Could not load live sessions");
      const data = (await res.json()) as { sessions: LiveSessionRow[]; hostSessionCount?: number };
      setSessions(data.sessions ?? []);
      setHostSessionCount(data.hostSessionCount ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const openSession = (s: LiveSessionRow, asGuest = false) => {
    const id = sessionRouteId(s);
    router.push(asGuest ? `/live/${id}?as=guest` : `/live/${id}`);
  };

  const startSession = async (s: LiveSessionRow) => {
    const id = sessionRouteId(s);
    setBusyId(s.id);
    setError(null);
    try {
      const res = await fetch("/api/live/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id, action: "go-live" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not start session");
      router.push(`/live/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session");
      setBusyId(null);
    }
  };

  const reserveSeat = async (s: LiveSessionRow) => {
    const id = sessionRouteId(s);
    setBusyId(s.id);
    setError(null);
    try {
      const res = await fetch("/api/live/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not reserve seat");
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reserve seat");
    } finally {
      setBusyId(null);
    }
  };

  const filters: [LiveFilter, string][] = [
    ["all", "All sessions"],
    ...(hostSessionCount > 0 ? ([["mine", "My sessions"]] as [LiveFilter, string][]) : []),
    ["live", "Live now"],
    ["week", "This week"],
  ];

  const weekly = sessions.find((s) => s.isFeaturedWeekly) || sessions[0];
  const liveNow = sessions.filter((s) => s.isLive);
  const upcoming = sessions.filter((s) => !s.isFeaturedWeekly && !s.isLive);

  const visible = (() => {
    if (filter === "mine") return sessions.filter((s) => s.canHost);
    if (filter === "live") return liveNow;
    if (filter === "week") return upcoming;
    return [...liveNow, ...upcoming];
  })();

  const sessionCta = (s: LiveSessionRow) => {
    if (s.canHost) {
      if (s.isLive) {
        return { label: "Join as host →", onClick: () => openSession(s), busy: false };
      }
      return {
        label: busyId === s.id ? "Starting…" : "Start session →",
        onClick: () => void startSession(s),
        busy: busyId === s.id,
      };
    }
    if (s.isLive) {
      return { label: "Join now →", onClick: () => openSession(s), busy: false };
    }
    if (s.isRegistered) {
      return {
        label: "View session →",
        onClick: () => openSession(s),
        busy: false,
      };
    }
    return {
      label: busyId === s.id ? "Saving…" : "Reserve seat →",
      onClick: () => void reserveSeat(s),
      busy: busyId === s.id,
    };
  };

  if (loading && sessions.length === 0) {
    return (
      <WorkspacePageShell isMobile={isMobile} label="Live with Second Ladder" mobileBarTitle="Live" title="Real sessions, real coaches.">
        <p style={{ fontFamily: fontSans, color: color.muted }}>Loading sessions…</p>
      </WorkspacePageShell>
    );
  }

  return (
    <WorkspacePageShell
      isMobile={isMobile}
      label="Live with Second Ladder"
      mobileBarTitle="Live"
      title="Real sessions, real coaches."
    >
        {error && (
          <p style={{ fontFamily: fontSans, color: "#C4574A", marginBottom: 16 }}>{error}</p>
        )}

        {liveNow.length > 0 && filter !== "week" && (
          <ScoutBox padding={16} style={{ marginBottom: 16, background: "rgba(196,87,74,0.08)", borderColor: "#C4574A" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: "#8B3A32", margin: "0 0 8px" }}>
              {liveNow.length === 1 ? "1 session is live right now" : `${liveNow.length} sessions are live`}
            </p>
            <ScoutPrimaryBtn
              onClick={() => openSession(liveNow[0]!)}
              style={{ background: "#C4574A", color: "#fff", borderColor: "#C4574A", minHeight: 44 }}
            >
              Join {liveNow[0]!.title.slice(0, 40)}{liveNow[0]!.title.length > 40 ? "…" : ""} →
            </ScoutPrimaryBtn>
          </ScoutBox>
        )}

        {weekly && filter !== "mine" && (
        <div
          style={{
            background: weekly.bgColor,
            border: border.lineStrong,
            padding: isMobile ? 20 : 24,
            marginBottom: 20,
            color: weekly.accentColor,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ padding: "3px 10px", background: weekly.accentColor, color: weekly.bgColor, borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
              Weekly
            </span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: weekly.accentColor, opacity: 0.6 }}>
              {weekly.startsIn}
            </span>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 500, fontStyle: "italic", color: "#FFFFFF", lineHeight: 1.2, marginBottom: 10 }}>
            {weekly.title}
          </h2>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 400, color: weekly.accentColor, opacity: 0.85, lineHeight: 1.6, marginBottom: 16, maxWidth: 600, textWrap: "pretty" }}>
            {weekly.description}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: weekly.accentColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: weekly.bgColor }}>{weekly.hostInitials}</span>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>{weekly.host}</p>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: weekly.accentColor, opacity: 0.7 }}>
                {weekly.hostRole}{weekly.hostRating != null ? ` · ★ ${weekly.hostRating}` : ""}
              </p>
            </div>
          </div>
          <ScoutPrimaryBtn
            onClick={() => sessionCta(weekly).onClick()}
            disabled={sessionCta(weekly).busy}
            style={{ background: weekly.accentColor, color: weekly.bgColor, border: border.lineStrong, minHeight: isMobile ? 44 : undefined }}
          >
            {sessionCta(weekly).label}
          </ScoutPrimaryBtn>
        </div>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {filters.map(([id, label]) => {
            const active = filter === id;
            const bg = id === "live" && active ? "#C4574A" : active ? "#1A3A2F" : "rgba(0,0,0,0.05)";
            const chipColor = id === "live" && active ? "#FFFFFF" : active ? "#E8D5A3" : "#52493F";
            return (
              <button key={id} onClick={() => setFilter(id)} style={{ padding: "6px 14px", background: bg, color: chipColor, border: "none", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, paddingBottom: 40 }}>
          {visible.map((s) => {
            const cta = sessionCta(s);
            return (
            <ScoutBox key={s.id} padding={0} style={{ overflow: "hidden" }}>
              <div style={{ background: s.bgColor, padding: "16px 18px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ padding: "2px 8px", background: s.accentColor, color: s.bgColor, borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>
                    {s.isLive ? "● Live" : s.category}
                  </span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: s.accentColor, opacity: 0.7 }}>{s.startsIn}</span>
                </div>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#FFFFFF", lineHeight: 1.3, marginBottom: 8 }}>{s.title}</p>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: s.accentColor, opacity: 0.7 }}>
                  with {s.host}{s.hostRating != null ? ` · ★ ${s.hostRating}` : ""}
                </p>
              </div>
              <div style={{ padding: "12px 18px 14px" }}>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 400, color: "#52493F", lineHeight: 1.55, marginBottom: 12, textWrap: "pretty" }}>{s.description}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--scout-muted)" }}>
                    {s.isLive ? `${s.registered} watching` : `${s.registered} registered`}
                  </span>
                  <ScoutPrimaryBtn
                    onClick={cta.onClick}
                    disabled={cta.busy}
                    style={{ padding: "6px 14px", background: s.isLive ? "#C4574A" : color.forest, color: s.isLive ? "#FFFFFF" : color.gold, minHeight: isMobile ? 40 : undefined, fontSize: T.bodySm }}
                  >
                    {cta.label}
                  </ScoutPrimaryBtn>
                </div>
              </div>
            </ScoutBox>
          );
          })}
        </div>
    </WorkspacePageShell>
  );
}
