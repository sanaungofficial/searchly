"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type RoomStatus = {
  roomId: string | null;
  roomEnabled: boolean;
  activePeerCount: number;
  isActive: boolean;
};

type AdminLiveSession = {
  id: number;
  title: string;
  host: string;
  category: string;
  date: string;
  time: string;
  staticIsLive: boolean;
  isLive: boolean;
  room: RoomStatus | null;
};

type AdminLiveResponse = {
  hmsConfigured: boolean;
  sessions: AdminLiveSession[];
  hostRoles: { host: string; guest: string };
};

export function LiveSessionsAdminPanel() {
  const router = useRouter();
  const [data, setData] = useState<AdminLiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/live");
      if (!res.ok) throw new Error("Failed to load live sessions");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading live sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (sessionId: number, action: "go-live" | "end" | "enable-room" | "disable-room") => {
    setBusyId(sessionId);
    setError(null);
    try {
      const res = await fetch("/api/admin/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Action failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const openAsHost = (sessionId: number) => {
    router.push(`/live/${sessionId}`);
  };

  const openAsGuest = (sessionId: number) => {
    router.push(`/live/${sessionId}?as=guest`);
  };

  return (
    <div>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 20px", lineHeight: 1.6 }}>
        Manage Kimchi live rooms via 100ms. Coaches and admins join the same{" "}
        <code style={{ fontFamily: fontMono, fontSize: T.label }}>/live/[id]</code> URL — the server assigns{" "}
        <strong>host</strong> (screen share, controls) or <strong>guest</strong> (participant) based on role.
        Use <em>Preview as guest</em> below to test the client experience without impersonation.
      </p>

      {!data?.hmsConfigured && (
        <ScoutBox padding={16} style={{ marginBottom: 16, background: "rgba(196,87,74,0.08)", borderColor: "#C4574A" }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#8B3A32", margin: 0 }}>
            100ms is not configured on this deployment. Set <code>HMS_ACCESS_KEY</code> and <code>HMS_SECRET</code> in Vercel.
          </p>
        </ScoutBox>
      )}

      {data?.hmsConfigured && (
        <ScoutBox padding={16} style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.stone, margin: "0 0 6px" }}>
            Template roles (must match your 100ms dashboard)
          </p>
          <p style={{ fontFamily: fontMono, fontSize: T.label, margin: 0 }}>
            host → {data.hostRoles.host} · guest → {data.hostRoles.guest}
          </p>
        </ScoutBox>
      )}

      {loading && <p style={{ fontFamily: fontSans, color: color.muted }}>Loading sessions…</p>}
      {error && (
        <p style={{ fontFamily: fontSans, color: "#dc2626", marginBottom: 16 }}>{error}</p>
      )}

      {!loading && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.sessions.map((session) => (
            <ScoutBox key={session.id} padding={0} style={{ overflow: "hidden" }}>
              <div style={{ padding: "16px 18px", borderBottom: border.line }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontFamily: fontMono, fontSize: 11, color: color.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Session #{session.id} · {session.category}
                    </p>
                    <h2 style={{ fontFamily: fontSans, fontSize: 17, fontWeight: 700, margin: "0 0 4px", color: color.ink }}>
                      {session.title}
                    </h2>
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                      {session.host} · {session.date} · {session.time}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        background: session.isLive ? "#C4574A" : color.forest,
                        color: session.isLive ? "#fff" : color.gold,
                        fontFamily: fontSans,
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {session.isLive ? "Live now" : "Scheduled"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: 10,
                    fontFamily: fontSans,
                    fontSize: T.caption,
                    color: color.stone,
                  }}
                >
                  <div>
                    <strong>Room</strong>
                    <br />
                    {session.room?.roomId ? (
                      <code style={{ fontFamily: fontMono, fontSize: 10 }}>{session.room.roomId.slice(0, 12)}…</code>
                    ) : (
                      "Not created yet"
                    )}
                  </div>
                  <div>
                    <strong>Room enabled</strong>
                    <br />
                    {session.room?.roomId ? (session.room.roomEnabled ? "Yes" : "No (locked)") : "—"}
                  </div>
                  <div>
                    <strong>Active peers</strong>
                    <br />
                    {session.room?.activePeerCount ?? 0}
                    {session.room?.isActive ? " (in session)" : ""}
                  </div>
                  <div>
                    <strong>Catalog default</strong>
                    <br />
                    {session.staticIsLive ? "Marked live in UI data" : "Upcoming"}
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <ScoutPrimaryBtn
                    disabled={busyId === session.id || !data.hmsConfigured}
                    onClick={() => void runAction(session.id, "go-live")}
                    style={{ minHeight: 40 }}
                  >
                    {busyId === session.id ? "Working…" : "Mark live + enable room"}
                  </ScoutPrimaryBtn>
                  <ScoutSecondaryBtn
                    disabled={busyId === session.id || !data.hmsConfigured}
                    onClick={() => void runAction(session.id, "end")}
                    style={{ minHeight: 40 }}
                  >
                    End session + lock room
                  </ScoutSecondaryBtn>
                  <ScoutSecondaryBtn
                    disabled={!data.hmsConfigured}
                    onClick={() => openAsHost(session.id)}
                    style={{ minHeight: 40 }}
                  >
                    Join as host →
                  </ScoutSecondaryBtn>
                  <ScoutSecondaryBtn
                    disabled={!data.hmsConfigured}
                    onClick={() => openAsGuest(session.id)}
                    style={{ minHeight: 40 }}
                  >
                    Preview as guest →
                  </ScoutSecondaryBtn>
                </div>
              </div>
            </ScoutBox>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminLivePageHeader() {
  return (
    <h1 style={{ ...displayTitleStyle(28), margin: "0 0 8px" }}>Live sessions</h1>
  );
}
