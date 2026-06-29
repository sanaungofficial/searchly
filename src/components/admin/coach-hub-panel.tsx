"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { BookingsList } from "@/components/scout/bookings-list";
import { ScoutBox } from "@/components/scout/scout-box";
import type { HubBooking, HubCommunication, CoachClientSummary, CoachHubStats } from "@/lib/coach-hub";
import { bookingStatusColor, formatBookingWhen } from "@/lib/booking-display";
import { emailDomainLooksMicrosoft } from "@/lib/nylas";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type CoachInfo = {
  id: string;
  displayName: string;
  email: string | null;
  slug: string | null;
  photoUrl: string | null;
  headline: string | null;
  status?: string;
  calendarConnected: boolean;
  schedulerReady?: boolean;
  nylasSchedulerSlug?: string | null;
  schedulerTimezone?: string | null;
  schedulerOpenHourStart?: string | null;
  schedulerOpenHourEnd?: string | null;
  schedulerOpenDays?: number[];
  schedulerDurationMinutes?: number;
};

type HubPayload = {
  coach: CoachInfo;
  stats: CoachHubStats;
  clients: CoachClientSummary[];
  communications: HubCommunication[];
  upcomingBookings: HubBooking[];
  pastBookings: HubBooking[];
};

type Props = {
  apiPath: string;
  mode: "admin" | "coach";
  coachId?: string;
  backHref?: string;
  showAdminLinks?: boolean;
  /** When true, hides back navigation (e.g. inside a drawer). */
  embedded?: boolean;
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <ScoutBox padding="14px 16px">
      <p style={{ margin: 0, fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 24, fontWeight: 600, color: color.forest }}>{value}</p>
    </ScoutBox>
  );
}

function commLabel(type: HubCommunication["type"]) {
  switch (type) {
    case "GUEST_CONFIRMATION":
      return "Confirmation sent";
    case "COACH_NOTIFICATION":
      return "Coach notified";
    case "CANCELLATION":
      return "Cancellation";
    case "SESSION_BOOKED":
      return "Session booked";
    case "SESSION_RESCHEDULED":
      return "Rescheduled";
    case "SESSION_CANCELLED":
      return "Cancelled";
    default:
      return type;
  }
}

export function CoachHubPanel({ apiPath, mode, coachId, backHref, showAdminLinks = false, embedded = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<HubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<CoachClientSummary | null>(null);
  const [retryingScheduler, setRetryingScheduler] = useState(false);
  const [nylasNotice, setNylasNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const nylas = searchParams.get("nylas");
    const reason = searchParams.get("reason");
    const detail = searchParams.get("detail");
    if (!nylas) return;

    if (nylas === "connected") {
      setNylasNotice({
        type: "success",
        message: "Calendar connected — in-app booking is enabled for this coach.",
      });
    } else if (nylas === "error") {
      const messages: Record<string, string> = {
        config: "Nylas is not configured on this environment.",
        auth: "Calendar authorization was cancelled or failed.",
        denied: "Calendar access was denied.",
        redirect: "OAuth redirect URI mismatch — check Nylas dashboard.",
        setup: "Connected, but scheduler setup failed. Try retry below.",
        profile: "Coach profile not found after OAuth.",
        state: "OAuth state expired — try connecting again.",
      };
      let message = messages[reason ?? ""] ?? "Calendar connection failed.";
      if (detail) message += ` (${detail})`;
      setNylasNotice({ type: "error", message });
    }

    if (coachId && mode === "admin") {
      router.replace(`/admin/experts?coachId=${encodeURIComponent(coachId)}`, { scroll: false });
    }
  }, [searchParams, coachId, mode, router]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedClient?.userId) params.set("clientUserId", selectedClient.userId);
    else if (selectedClient?.email) params.set("clientEmail", selectedClient.email);
    const qs = params.toString();
    fetch(`${apiPath}${qs ? `?${qs}` : ""}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load coach hub");
        return r.json();
      })
      .then((payload) => setData(payload))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [apiPath, selectedClient]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredClients = useMemo(() => data?.clients ?? [], [data]);

  async function retryScheduler() {
    if (!coachId) return;
    setRetryingScheduler(true);
    setNylasNotice(null);
    try {
      const r = await fetch(`/api/admin/coaches/${coachId}/nylas/retry-scheduler`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Scheduler setup failed");
      setNylasNotice({
        type: "success",
        message: d.created ? "Scheduler created for this coach." : "Scheduler settings updated.",
      });
      load();
    } catch (e) {
      setNylasNotice({
        type: "error",
        message: e instanceof Error ? e.message : "Scheduler setup failed",
      });
    } finally {
      setRetryingScheduler(false);
    }
  }

  if (loading && !data) {
    return <p style={{ fontFamily: fontSans, color: color.muted, padding: "24px 0" }}>Loading coach hub…</p>;
  }

  if (error || !data) {
    return <p style={{ fontFamily: fontSans, color: "#dc2626", padding: "24px 0" }}>{error ?? "Unable to load hub"}</p>;
  }

  const { coach, stats, communications, upcomingBookings, pastBookings } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {nylasNotice && (
        <div
          style={{
            padding: "12px 16px",
            border: "var(--scout-border)",
            background: nylasNotice.type === "success" ? "rgba(45,122,80,0.08)" : "rgba(220,38,38,0.06)",
            fontFamily: fontSans,
            fontSize: 14,
            color: nylasNotice.type === "success" ? color.forest : "#b45309",
          }}
        >
          {nylasNotice.message}
        </div>
      )}

      {backHref && !embedded && (
        <button
          type="button"
          onClick={() => router.push(backHref)}
          style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: 13, color: color.forest, cursor: "pointer", textDecoration: "underline" }}
        >
          ← Back to coaches
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 280px) 1fr", gap: 20, alignItems: "start" }}>
        <ScoutBox padding={20}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
            <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={56} />
            <div>
              <h2 style={{ ...displayTitleStyle(22), margin: 0 }}>{coach.displayName}</h2>
              {coach.headline && (
                <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>{coach.headline}</p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: fontSans, fontSize: 13, color: color.stone }}>
            {coach.email && <p style={{ margin: 0 }}>{coach.email}</p>}
            <p style={{ margin: 0 }}>
              Calendar:{" "}
              <span style={{ color: coach.calendarConnected ? color.forest : color.muted }}>
                {coach.calendarConnected ? "Connected" : "Not connected"}
              </span>
            </p>
            {coach.status && (
              <p style={{ margin: 0 }}>
                Status: <span style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase" }}>{coach.status.toLowerCase()}</span>
              </p>
            )}
          </div>
          {mode === "admin" && coachId && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "var(--scout-border)" }}>
              <p style={{ margin: "0 0 8px", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                Calendar (Nylas)
              </p>
              <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 12, color: color.muted, lineHeight: 1.45 }}>
                Connect on behalf of this coach. For Outlook, sign in with their Microsoft work or personal account
                {coach.email && emailDomainLooksMicrosoft(coach.email)
                  ? ` (${coach.email})`
                  : coach.email
                    ? " — use their Outlook/Microsoft email, not the Gmail on file"
                    : ""}.
              </p>
              {coach.schedulerReady ? (
                <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: 13, color: color.forest }}>
                  Scheduler ready — seekers can book in-app.
                </p>
              ) : coach.calendarConnected ? (
                <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: 13, color: "#b45309" }}>
                  Calendar linked but booking setup incomplete.
                </p>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a
                  href={`/api/admin/coaches/${coachId}/nylas/connect?provider=google`}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "10px 14px",
                    background: color.forest,
                    color: color.gold,
                    fontFamily: fontSans,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                    border: "var(--scout-border)",
                  }}
                >
                  {coach.calendarConnected ? "Reconnect Google Calendar" : "Connect Google Calendar"}
                </a>
                <a
                  href={`/api/admin/coaches/${coachId}/nylas/connect?provider=microsoft`}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "10px 14px",
                    background: surface.card,
                    color: color.stone,
                    fontFamily: fontSans,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                    border: "var(--scout-border)",
                  }}
                >
                  {coach.calendarConnected ? "Reconnect Outlook" : "Connect Outlook"}
                </a>
                {coach.calendarConnected && !coach.schedulerReady && (
                  <button
                    type="button"
                    onClick={retryScheduler}
                    disabled={retryingScheduler}
                    style={{
                      padding: "10px 14px",
                      background: surface.card,
                      border: "var(--scout-border)",
                      fontFamily: fontSans,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: retryingScheduler ? "wait" : "pointer",
                    }}
                  >
                    {retryingScheduler ? "Setting up scheduler…" : "Retry scheduler setup"}
                  </button>
                )}
                {coach.calendarConnected && coach.schedulerReady && coachId && (
                  <Link
                    href={`/admin/experts?coachId=${encodeURIComponent(coachId)}&tab=availability`}
                    style={{
                      display: "block",
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: "var(--scout-border)",
                      fontFamily: fontSans,
                      fontSize: 13,
                      fontWeight: 600,
                      color: color.forest,
                      textDecoration: "none",
                    }}
                  >
                    Edit availability →
                  </Link>
                )}
              </div>
            </div>
          )}
          {showAdminLinks && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {coach.slug && (
                <Link href={`/coach/${coach.slug}`} style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}>
                  Public profile →
                </Link>
              )}
              {coach.slug && coach.nylasSchedulerSlug && (
                <Link href={`/coach/${coach.slug}`} style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}>
                  Scheduler link →
                </Link>
              )}
              {coachId && (
                <Link href={`/admin/purchases?coachId=${encodeURIComponent(coachId)}`} style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}>
                  Package purchases →
                </Link>
              )}
            </div>
          )}
        </ScoutBox>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          <StatCard label="Clients" value={stats.uniqueClients} />
          <StatCard label="Total sessions" value={stats.totalSessions} />
          <StatCard label="Completed" value={stats.completedSessions} />
          <StatCard label="Upcoming" value={stats.upcomingSessions} />
          <StatCard label="Cancelled" value={stats.cancelledSessions} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 340px) 1fr 1fr", gap: 20, alignItems: "start" }}>
        <ScoutBox padding={20}>
          <p style={{ margin: "0 0 12px", fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
            Clients
          </p>
          {filteredClients.length === 0 ? (
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.muted }}>No clients yet — bookings will appear here.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredClients.map((client) => {
                const active = selectedClient?.email === client.email;
                return (
                  <button
                    key={client.email}
                    type="button"
                    onClick={() => setSelectedClient(active ? null : client)}
                    style={{
                      textAlign: "left",
                      border: active ? `1px solid ${color.forest}` : "var(--scout-border)",
                      background: active ? "rgba(45,122,80,0.06)" : "#fff",
                      padding: "12px 14px",
                      cursor: "pointer",
                    }}
                  >
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, fontWeight: 600 }}>{client.name ?? client.email}</p>
                    <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 12, color: color.muted }}>{client.email}</p>
                    <p style={{ margin: "6px 0 0", fontFamily: fontMono, fontSize: 11, color: color.stone }}>
                      {client.sessionCount} session{client.sessionCount === 1 ? "" : "s"}
                      {client.upcomingCount > 0 ? ` · ${client.upcomingCount} upcoming` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          {selectedClient && (
            <button
              type="button"
              onClick={() => setSelectedClient(null)}
              style={{ marginTop: 12, background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: 13, color: color.forest, cursor: "pointer" }}
            >
              Clear client filter
            </button>
          )}
        </ScoutBox>

        <ScoutBox padding={20}>
          <p style={{ margin: "0 0 12px", fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
            Communications
          </p>
          {communications.length === 0 ? (
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.muted }}>
              Booking confirmations and session updates will appear here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
              {communications.map((c) => (
                <div key={c.id} style={{ borderBottom: "var(--scout-border)", paddingBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>{c.subject}</p>
                    <span style={{ fontFamily: fontMono, fontSize: 10, color: color.muted, whiteSpace: "nowrap" }}>
                      {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                    {commLabel(c.type)} · {c.audience === "GUEST" ? "To client" : c.audience === "COACH" ? "To coach" : "System"}
                  </p>
                  {c.bodyPreview && (
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: color.stone, lineHeight: 1.5 }}>{c.bodyPreview}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScoutBox>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ScoutBox padding={20}>
            <p style={{ margin: "0 0 12px", fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
              Upcoming sessions
            </p>
            <BookingsList
              bookings={upcomingBookings.map((b) => ({
                id: b.id,
                coachName: b.coachName,
                coachSlug: b.coachSlug,
                guestName: b.guestName,
                guestEmail: b.guestEmail,
                title: b.title,
                location: b.location,
                startAt: b.startAt,
                endAt: b.endAt,
                status: b.status,
                nylasBookingRef: b.nylasBookingRef,
              }))}
              emptyMessage="No upcoming sessions."
              showGuest
              showCoach={false}
            />
          </ScoutBox>

          <ScoutBox padding={20}>
            <p style={{ margin: "0 0 12px", fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
              Past sessions
            </p>
            {pastBookings.length === 0 ? (
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.muted }}>No past sessions yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pastBookings.slice(0, 8).map((b) => {
                  const { date, time } = formatBookingWhen(b.startAt, b.endAt);
                  const statusStyle = bookingStatusColor(b.status);
                  return (
                    <ScoutBox key={b.id} flat padding="10px 12px">
                      <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>
                        {b.guestName ?? b.guestEmail ?? "Guest"}
                      </p>
                      <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                        {date} · {time} · {b.durationMinutes} min
                      </p>
                      <span style={{ fontFamily: fontMono, fontSize: 10, padding: "2px 6px", background: statusStyle.bg, color: statusStyle.color }}>
                        {b.status.toLowerCase()}
                      </span>
                    </ScoutBox>
                  );
                })}
              </div>
            )}
          </ScoutBox>
        </div>
      </div>

      {mode === "coach" && (
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted }}>
          Need full client profiles? Switch to the Clients tab for pipeline and resume details.
        </p>
      )}
    </div>
  );
}
