"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveSessionView } from "@/lib/live-session-types";
import { liveSessionRouteId } from "@/lib/live-sessions";
import { ScoutPrimaryBtn } from "./scout-box";
import { color, fontSans, border as B } from "@/lib/typography";

type LiveSessionRow = LiveSessionView & { canHost?: boolean };

export function LiveSessionLobby({
  session,
  joinAsGuest = false,
  onEnterRoom,
}: {
  session: LiveSessionView;
  joinAsGuest?: boolean;
  onEnterRoom: () => void;
}) {
  const router = useRouter();
  const routeId = liveSessionRouteId(session);
  const [row, setRow] = useState<LiveSessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/live/sessions");
      if (!res.ok) throw new Error("Could not load session");
      const data = (await res.json()) as { sessions: LiveSessionRow[] };
      const match =
        data.sessions?.find((s) => s.id === session.id) ??
        data.sessions?.find(
          (s) =>
            session.legacyNumericId != null &&
            s.legacyNumericId === session.legacyNumericId,
        );
      setRow(match ?? { ...session });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load session");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reserveSeat = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/live/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: routeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not register");
      setMessage("You're registered — we'll email you before it starts.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register");
    } finally {
      setBusy(false);
    }
  };

  const startSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/live/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: routeId, action: "go-live" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not start session");
      await refresh();
      onEnterRoom();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session");
      setBusy(false);
    }
  };

  const s = row ?? session;
  const canHost = Boolean(s.canHost) && !joinAsGuest;

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <p style={{ fontFamily: fontSans, color: color.muted }}>Loading session…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 48px" }}>
      <div
        style={{
          background: s.bgColor,
          border: B.lineStrong,
          padding: "24px 22px",
          marginBottom: 20,
          color: s.accentColor,
        }}
      >
        {s.isLive && (
          <span
            style={{
              display: "inline-block",
              padding: "3px 10px",
              background: "#C4574A",
              color: "#fff",
              fontFamily: fontSans,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 10,
            }}
          >
            ● Live now
          </span>
        )}
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 500,
            fontStyle: "italic",
            color: "#fff",
            margin: "0 0 10px",
            lineHeight: 1.2,
          }}
        >
          {s.title}
        </h1>
        <p style={{ fontFamily: fontSans, fontSize: 14, opacity: 0.85, margin: "0 0 6px" }}>
          {s.date} · {s.time}
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 14, opacity: 0.75, margin: 0 }}>
          with {s.host}
          {s.hostRating != null ? ` · ★ ${s.hostRating}` : ""}
        </p>
      </div>

      <p
        style={{
          fontFamily: fontSans,
          fontSize: 15,
          color: color.stone,
          lineHeight: 1.65,
          marginBottom: 20,
        }}
      >
        {s.description}
      </p>

      {error && (
        <p style={{ fontFamily: fontSans, color: "#C4574A", marginBottom: 16 }}>{error}</p>
      )}
      {message && (
        <p style={{ fontFamily: fontSans, color: color.forest, marginBottom: 16 }}>{message}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {canHost && !s.isLive && (
          <ScoutPrimaryBtn
            onClick={() => void startSession()}
            disabled={busy}
            style={{ minHeight: 48, background: color.forest, color: color.gold }}
          >
            {busy ? "Starting…" : "Start session →"}
          </ScoutPrimaryBtn>
        )}

        {(s.isLive || canHost) && (
          <ScoutPrimaryBtn
            onClick={onEnterRoom}
            disabled={busy}
            style={{
              minHeight: 48,
              background: s.isLive ? "#C4574A" : color.forest,
              color: s.isLive ? "#fff" : color.gold,
              borderColor: s.isLive ? "#C4574A" : undefined,
            }}
          >
            {canHost ? "Join as host →" : "Join now →"}
          </ScoutPrimaryBtn>
        )}

        {!s.isLive && !canHost && (
          <>
            {s.isRegistered ? (
              <div
                style={{
                  padding: "16px 18px",
                  background: "rgba(26,58,47,0.06)",
                  border: B.line,
                  fontFamily: fontSans,
                  fontSize: 14,
                  color: color.stone,
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: color.forest }}>You&apos;re registered.</strong> Come back when
                we&apos;re live — use this same link to join in one click.
              </div>
            ) : (
              <ScoutPrimaryBtn
                onClick={() => void reserveSeat()}
                disabled={busy}
                style={{ minHeight: 48, background: color.forest, color: color.gold }}
              >
                {busy ? "Saving…" : "Register for this session →"}
              </ScoutPrimaryBtn>
            )}
          </>
        )}
      </div>

      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, marginTop: 20 }}>
        {s.isLive
          ? `${s.registered} watching`
          : `${s.registered} registered`}
        {!s.isLive && !canHost ? " · video opens when the host goes live" : ""}
      </p>

      <button
        type="button"
        onClick={() => router.push("/live")}
        style={{
          marginTop: 24,
          background: "none",
          border: "none",
          padding: 0,
          fontFamily: fontSans,
          fontSize: 14,
          color: color.forest,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        ← All live sessions
      </button>
    </div>
  );
}
