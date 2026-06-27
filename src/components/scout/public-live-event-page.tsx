"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { LiveSessionView } from "@/lib/live-session-types";
import { liveSessionRouteId } from "@/lib/live-sessions";
import { LiveSessionRoomPage } from "@/components/scout/live-session-room-page";
import { ScoutBox, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { border, color, fontSans, type as T } from "@/lib/typography";

type Props = {
  session: LiveSessionView;
  joinAsGuest?: boolean;
};

export function PublicLiveEventPage({ session, joinAsGuest = false }: Props) {
  const isMobile = useIsMobile();
  const routeId = liveSessionRouteId(session);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [registrantCount, setRegistrantCount] = useState(session.registered);
  const [registrantPreview, setRegistrantPreview] = useState<Array<{ name: string }>>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setLoggedIn(Boolean(data.user)))
      .catch(() => setLoggedIn(false));
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/live/public/sessions/${routeId}`);
    if (!res.ok) return;
    const data = (await res.json().catch(() => ({}))) as {
      registrantCount?: number;
      registrantPreview?: Array<{ name: string }>;
    };
    setRegistrantCount(data.registrantCount ?? 0);
    setRegistrantPreview(data.registrantPreview ?? []);
  }, [routeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const registerGuest = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/live/register-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: routeId, email, name }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      setRegistered(true);
      setMessage(data.message ?? "You're registered!");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const registerLoggedIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/live/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: routeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      setRegistered(true);
      setMessage("You're registered — we'll email you before it starts.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  if (session.isLive || joinAsGuest) {
    return <LiveSessionRoomPage session={session} joinAsGuest={joinAsGuest} />;
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: isMobile ? "24px 16px 48px" : "32px 24px 56px" }}>
      <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
        <Link href="/live" style={{ color: color.forest }}>Live webinars</Link> / {session.category}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 24, alignItems: "start" }}>
        <div>
          {session.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.coverImageUrl}
              alt=""
              style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 8, marginBottom: 20, border: border.line }}
            />
          )}
          <h1 style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: isMobile ? 26 : 32, fontWeight: 600, color: color.ink, lineHeight: 1.2 }}>
            {session.title}
          </h1>
          <ScoutBox padding={18} style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 14, fontWeight: 600 }}>{session.date}</p>
            <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 14, color: color.muted }}>{session.time}</p>
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted }}>
              {session.format === "BROADCAST" ? "Broadcast webinar" : "Interactive live session"} · Virtual event
            </p>
          </ScoutBox>

          <h2 style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: 18, fontWeight: 600 }}>About the event</h2>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {session.description}
          </p>
        </div>

        <aside>
          <ScoutBox padding={20}>
            <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.forest }}>
              {registrantCount} {registrantCount === 1 ? "person" : "people"} going
            </p>
            {registrantPreview.length > 0 && (
              <p style={{ margin: "0 0 16px", fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                {registrantPreview
                  .slice(0, 3)
                  .map((r) => r.name)
                  .join(", ")}
                {registrantCount > 3 ? ` and ${registrantCount - 3} others` : ""}
              </p>
            )}

            {registered || message ? (
              <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 13, color: color.forest, lineHeight: 1.5 }}>{message}</p>
            ) : loggedIn === false ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ padding: "10px 12px", border: border.line, fontFamily: fontSans, fontSize: 14 }}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ padding: "10px 12px", border: border.line, fontFamily: fontSans, fontSize: 14 }}
                />
                <ScoutPrimaryBtn type="button" disabled={busy} onClick={() => void registerGuest()}>
                  {busy ? "Registering…" : "Register — it's free"}
                </ScoutPrimaryBtn>
              </div>
            ) : loggedIn === true ? (
              <ScoutPrimaryBtn type="button" disabled={busy} onClick={() => void registerLoggedIn()}>
                {busy ? "Registering…" : "Reserve your seat"}
              </ScoutPrimaryBtn>
            ) : (
              <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>Loading…</p>
            )}

            {error && <p style={{ margin: "12px 0 0", fontFamily: fontSans, fontSize: 13, color: "#b42318" }}>{error}</p>}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: border.line }}>
              <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 12, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Hosted by
              </p>
              <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 16, fontWeight: 600 }}>{session.host}</p>
              {session.hostRole && (
                <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 13, color: color.muted }}>{session.hostRole}</p>
              )}
              {session.coHosts?.map((h) => (
                <p key={h.id} style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 13, color: color.stone }}>
                  Co-host: {h.displayName}
                </p>
              ))}
              {session.coachSlug && (
                <Link href={`/coaching?coach=${session.coachSlug}`} style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.forest }}>
                  View coach profile →
                </Link>
              )}
            </div>
          </ScoutBox>

          {loggedIn === false && (
            <p style={{ marginTop: 12, fontFamily: fontSans, fontSize: 12, color: color.muted, lineHeight: 1.5 }}>
              Already have an account? <Link href={`/login?next=/live/${routeId}`}>Sign in</Link>
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
