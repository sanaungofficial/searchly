"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ScoutBox } from "@/components/scout/scout-box";
import {
  BOOKING_NOTICE_OPTIONS,
  BUFFER_OPTIONS,
  CAPACITY_OPTIONS,
  DEFAULT_MIN_BOOKING_NOTICE_MINUTES,
  MIN_WEEKLY_AVAILABILITY_HOURS,
  SCHEDULER_TIMEZONE_OPTIONS,
  WEEKDAY_LABELS,
  formatTimezoneLabel,
  resolveWeeklyHours,
  weeklyAvailabilityHours,
  type SchedulerDayHours,
} from "@/lib/coach-scheduler-settings";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type CoachStatus = "ACTIVE" | "PENDING" | "INACTIVE";

type ProfilePayload = {
  id: string;
  displayName: string;
  email: string | null;
  status: CoachStatus;
  nylasGrantId?: string | null;
  nylasGrantStatus?: string | null;
  nylasGrantEmail?: string | null;
  nylasEmailSyncEnabled?: boolean;
  nylasSchedulerConfigId?: string | null;
  nylasIntroSchedulerConfigId?: string | null;
  nylasSchedulerCalendarIds?: unknown;
  nylasConferenceProvider?: string | null;
  schedulerTimezone?: string | null;
  schedulerDurationMinutes?: number | null;
  schedulerWeeklyHours?: unknown;
  schedulerBufferMinutes?: number | null;
  schedulerMinBookingNoticeMinutes?: number | null;
  schedulerCapacityHoursPerWeek?: number | null;
  schedulerAvailabilityNotes?: string | null;
  schedulerBlackoutDates?: unknown;
  schedulerOpenHourStart?: string | null;
  schedulerOpenHourEnd?: string | null;
  schedulerOpenDays?: number[] | null;
};

type Props = {
  mode: "coach" | "admin";
  coachId?: string;
  backHref?: string;
  /** Hide page title and back link (e.g. inside admin coach drawer tab) */
  embedded?: boolean;
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontFamily: fontSans,
  fontSize: 18,
  fontWeight: 600,
  color: color.forest,
};

const sectionDesc: React.CSSProperties = {
  margin: "6px 0 0",
  fontFamily: fontSans,
  fontSize: 14,
  color: color.muted,
  lineHeight: 1.55,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: fontMono,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: color.muted,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 14,
  background: "#fff",
  border: border.line,
  borderRadius: "var(--scout-radius)",
  padding: "10px 12px",
  outline: "none",
  fontFamily: fontSans,
  boxSizing: "border-box",
  color: color.stone,
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        border: "none",
        padding: 0,
        background: checked ? color.forest : "rgba(26,58,47,0.18)",
        cursor: disabled ? "default" : "pointer",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}

function ConnectCalendarCard({ returnPath, emailSync }: { returnPath: string; emailSync?: boolean }) {
  const syncParam = emailSync ? "&emailSync=true" : "";
  return (
    <div
      style={{
        background: "rgba(26,58,47,0.04)",
        border: border.line,
        borderRadius: 8,
        padding: "20px 24px",
      }}
    >
      <p style={{ margin: 0, fontFamily: fontSans, fontSize: 16, fontWeight: 600, color: color.forest }}>
        Connect your calendar
      </p>
      <p style={{ margin: "8px 0 16px", fontFamily: fontSans, fontSize: 14, color: color.muted, lineHeight: 1.5 }}>
        When you connect a calendar, Kimchi can automatically block out your busy times.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a
          href={`/api/nylas/connect?provider=google&returnPath=${encodeURIComponent(returnPath)}${syncParam}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: "#fff",
            border: border.line,
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: 600,
            color: color.stone,
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: 16 }}>G</span>
          Connect Google Calendar
        </a>
        <a
          href={`/api/nylas/connect?provider=microsoft&returnPath=${encodeURIComponent(returnPath)}${syncParam}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: "#fff",
            border: border.line,
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: 600,
            color: color.stone,
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: 14, color: "#0078d4" }}>◆</span>
          Connect Outlook Calendar
        </a>
      </div>
    </div>
  );
}

export function CoachEditAvailabilityView({ mode, coachId, backHref = "/dashboard/offerings?section=availability", embedded = false }: Props) {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retryingScheduler, setRetryingScheduler] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [status, setStatus] = useState<CoachStatus>("ACTIVE");
  const [timezone, setTimezone] = useState<string>(SCHEDULER_TIMEZONE_OPTIONS[0]);
  const [weeklyHours, setWeeklyHours] = useState<SchedulerDayHours[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [minBookingNoticeMinutes, setMinBookingNoticeMinutes] = useState(DEFAULT_MIN_BOOKING_NOTICE_MINUTES);
  const [capacityHours, setCapacityHours] = useState<number | "">("");
  const [availabilityNotes, setAvailabilityNotes] = useState("");
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [newBlackoutDate, setNewBlackoutDate] = useState("");
  const [calendars, setCalendars] = useState<Array<{ id: string; name: string; isPrimary: boolean }>>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [conferenceProvider, setConferenceProvider] = useState<string>("");
  const [disconnecting, setDisconnecting] = useState(false);

  const returnPath =
    mode === "admin" && coachId
      ? `/admin/coaches?coachId=${encodeURIComponent(coachId)}&tab=availability`
      : "/dashboard/offerings?section=availability";

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "admin" && coachId) {
        const res = await fetch(`/api/admin/coach-hub?coachId=${encodeURIComponent(coachId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load coach");
        const coach = data.coach as ProfilePayload;
        setProfile(coach);
        applyProfile(coach);
      } else {
        const res = await fetch("/api/coach/profile");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load profile");
        setProfile(data);
        applyProfile(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load availability settings");
    } finally {
      setLoading(false);
    }
  }, [mode, coachId]);

  function applyProfile(p: ProfilePayload) {
    setStatus(p.status ?? "ACTIVE");
    setTimezone(p.schedulerTimezone ?? SCHEDULER_TIMEZONE_OPTIONS[0]);
    setWeeklyHours(resolveWeeklyHours(p));
    setDurationMinutes(p.schedulerDurationMinutes ?? 30);
    setBufferMinutes(p.schedulerBufferMinutes ?? 0);
    setMinBookingNoticeMinutes(p.schedulerMinBookingNoticeMinutes ?? DEFAULT_MIN_BOOKING_NOTICE_MINUTES);
    setCapacityHours(p.schedulerCapacityHoursPerWeek ?? "");
    setAvailabilityNotes(p.schedulerAvailabilityNotes ?? "");
    setBlackoutDates(
      Array.isArray(p.schedulerBlackoutDates)
        ? (p.schedulerBlackoutDates as string[]).filter(Boolean)
        : [],
    );
  }

  useEffect(() => {
    if (!profile?.nylasGrantId || profile.nylasGrantStatus === "expired") return;
    const url =
      mode === "admin" && coachId
        ? `/api/admin/coaches/${coachId}/nylas/calendars`
        : "/api/nylas/calendars";
    fetch(url)
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setCalendars(data.calendars ?? []);
        setSelectedCalendarIds(data.selectedCalendarIds ?? []);
      })
      .catch(() => {});
  }, [profile?.nylasGrantId, profile?.nylasGrantStatus, mode, coachId]);

  useEffect(() => {
    if (!profile) return;
    const ids = Array.isArray(profile.nylasSchedulerCalendarIds)
      ? (profile.nylasSchedulerCalendarIds as string[])
      : [];
    if (ids.length) setSelectedCalendarIds(ids);
    setConferenceProvider(profile.nylasConferenceProvider ?? "");
  }, [profile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function disconnectCalendar() {
    if (!confirm("Disconnect calendar? Clients will not be able to book until you reconnect.")) return;
    setDisconnecting(true);
    try {
      const url =
        mode === "admin" && coachId
          ? `/api/admin/coaches/${coachId}/nylas/disconnect`
          : "/api/nylas/disconnect";
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("Disconnect failed");
      await loadProfile();
      setNotice({ type: "success", message: "Calendar disconnected." });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Disconnect failed" });
    } finally {
      setDisconnecting(false);
    }
  }

  function toggleCalendarId(id: string) {
    setSelectedCalendarIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  useEffect(() => {
    const nylas = searchParams.get("nylas");
    if (!nylas) return;
    if (nylas === "connected") {
      setNotice({ type: "success", message: "Calendar connected successfully." });
      loadProfile();
    } else if (nylas === "error") {
      setNotice({ type: "error", message: "Calendar connection failed. Please try again." });
    }
  }, [searchParams, loadProfile]);

  const weeklyHoursTotal = useMemo(() => weeklyAvailabilityHours(weeklyHours), [weeklyHours]);
  const needsMoreHours = weeklyHoursTotal < MIN_WEEKLY_AVAILABILITY_HOURS;

  const calendarConnected = Boolean(profile?.nylasGrantId);
  const grantExpired = profile?.nylasGrantStatus === "expired";
  const schedulerReady = Boolean(profile?.nylasGrantId && profile?.nylasSchedulerConfigId && !grantExpired);

  async function retryScheduler() {
    setRetryingScheduler(true);
    try {
      const url =
        mode === "admin" && coachId
          ? `/api/admin/coaches/${coachId}/nylas/retry-scheduler`
          : "/api/nylas/retry-scheduler";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scheduler setup failed");
      await loadProfile();
      setNotice({ type: "success", message: "Scheduler is ready for bookings." });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Scheduler setup failed" });
    } finally {
      setRetryingScheduler(false);
    }
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    setNotice(null);
    try {
      const body = {
        status,
        schedulerTimezone: timezone,
        schedulerWeeklyHours: weeklyHours,
        schedulerDurationMinutes: durationMinutes,
        schedulerBufferMinutes: bufferMinutes,
        schedulerMinBookingNoticeMinutes: minBookingNoticeMinutes,
        schedulerCapacityHoursPerWeek: capacityHours === "" ? null : capacityHours,
        schedulerAvailabilityNotes: availabilityNotes,
        schedulerBlackoutDates: blackoutDates,
        nylasSchedulerCalendarIds: selectedCalendarIds.length ? selectedCalendarIds : null,
        nylasConferenceProvider: conferenceProvider || null,
      };
      const url =
        mode === "admin" && coachId ? `/api/admin/coaches/${coachId}` : "/api/coach/profile";
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setProfile(data);
      applyProfile(data);
      setNotice({ type: "success", message: "Availability saved — new settings are live for bookings." });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  function updateDay(day: number, patch: Partial<SchedulerDayHours>) {
    setWeeklyHours((rows) => rows.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  }

  function addBlackoutDate() {
    if (!newBlackoutDate || blackoutDates.includes(newBlackoutDate)) return;
    setBlackoutDates((d) => [...d, newBlackoutDate].sort());
    setNewBlackoutDate("");
  }

  if (loading) {
    return <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, padding: "40px 0" }}>Loading…</p>;
  }

  if (error && !profile) {
    return <p style={{ fontFamily: fontSans, fontSize: 14, color: "#b45309", padding: "40px 0" }}>{error}</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: embedded ? 24 : 80 }}>
      {!embedded && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={{ ...displayTitleStyle(32), margin: "0 0 8px" }}>Edit Availability</h1>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 560, lineHeight: 1.6 }}>
            This is where you can edit your calendar availabilities so clients can book time on your calendar.
          </p>
        </div>
        <Link
          href={backHref}
          style={{
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: 600,
            color: color.forest,
            textDecoration: "none",
            padding: "10px 16px",
            border: border.line,
            background: "#fff",
            flexShrink: 0,
          }}
        >
          Back to Calendar
        </Link>
      </div>
      )}

      {notice && (
        <div
          style={{
            padding: "12px 16px",
            background: notice.type === "success" ? "rgba(45,122,80,0.08)" : "rgba(220,38,38,0.08)",
            border: `1px solid ${notice.type === "success" ? "rgba(45,122,80,0.2)" : "rgba(220,38,38,0.2)"}`,
          }}
        >
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: notice.type === "success" ? color.forest : "#dc2626" }}>
            {notice.message}
          </p>
        </div>
      )}

      {grantExpired && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.2)",
          }}
        >
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: "#dc2626", fontWeight: 600 }}>
            Calendar connection expired
          </p>
          <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
            Reconnect Google or Outlook so clients can book again.
          </p>
        </div>
      )}

      <ScoutBox padding="24px 28px">
          {!calendarConnected ? (
            mode === "admin" && coachId ? (
              <div>
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: 16, fontWeight: 600, color: color.forest }}>
                  Connect calendar for this coach
                </p>
                <p style={{ margin: "8px 0 16px", fontFamily: fontSans, fontSize: 14, color: color.muted, lineHeight: 1.5 }}>
                  Connect Google or Outlook so clients can book sessions through Kimchi.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <a
                    href={`/api/admin/coaches/${coachId}/nylas/connect?provider=google`}
                    style={{
                      display: "inline-flex",
                      padding: "10px 18px",
                      background: color.forest,
                      color: color.gold,
                      fontFamily: fontSans,
                      fontSize: 14,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Connect Google Calendar
                  </a>
                  <a
                    href={`/api/admin/coaches/${coachId}/nylas/connect?provider=microsoft`}
                    style={{
                      display: "inline-flex",
                      padding: "10px 18px",
                      background: "#fff",
                      border: border.line,
                      fontFamily: fontSans,
                      fontSize: 14,
                      fontWeight: 600,
                      color: color.stone,
                      textDecoration: "none",
                    }}
                  >
                    Connect Outlook
                  </a>
                </div>
              </div>
            ) : (
              <ConnectCalendarCard returnPath={returnPath} />
            )
          ) : (
            <div>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.forest, fontWeight: 600 }}>
                Calendar connected
              </p>
              <p style={{ margin: "6px 0 12px", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                {schedulerReady
                  ? "Busy times from your calendar are blocked automatically."
                  : "Finish scheduler setup to enable in-app booking."}
              </p>
              {!schedulerReady && (
                <button
                  type="button"
                  onClick={retryScheduler}
                  disabled={retryingScheduler}
                  style={{
                    padding: "8px 14px",
                    background: color.forest,
                    color: color.gold,
                    border: "none",
                    fontFamily: fontSans,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: retryingScheduler ? "wait" : "pointer",
                  }}
                >
                  {retryingScheduler ? "Setting up…" : "Retry scheduler setup"}
                </button>
              )}
              <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {mode === "admin" && coachId ? (
                  <>
                    <a
                      href={`/api/admin/coaches/${coachId}/nylas/connect?provider=google`}
                      style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}
                    >
                      Reconnect Google
                    </a>
                    <a
                      href={`/api/admin/coaches/${coachId}/nylas/connect?provider=microsoft`}
                      style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}
                    >
                      Reconnect Outlook
                    </a>
                    <a
                      href={`/api/admin/coaches/${coachId}/nylas/connect?provider=google&emailSync=true`}
                      style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}
                    >
                      Reconnect with email sync
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href={`/api/nylas/connect?provider=google&returnPath=${encodeURIComponent(returnPath)}`}
                      style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}
                    >
                      Reconnect Google
                    </a>
                    <a
                      href={`/api/nylas/connect?provider=microsoft&returnPath=${encodeURIComponent(returnPath)}`}
                      style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}
                    >
                      Reconnect Outlook
                    </a>
                    <a
                      href={`/api/nylas/connect?provider=google&returnPath=${encodeURIComponent(returnPath)}&emailSync=true`}
                      style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}
                    >
                      Reconnect with email sync
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={disconnectCalendar}
                  disabled={disconnecting}
                  style={{
                    background: "none",
                    border: "none",
                    fontFamily: fontSans,
                    fontSize: 13,
                    color: "#dc2626",
                    cursor: disconnecting ? "wait" : "pointer",
                    padding: 0,
                  }}
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect calendar"}
                </button>
              </div>
              {profile?.nylasEmailSyncEnabled && (
                <p style={{ margin: "12px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                  Email sync enabled{profile.nylasGrantEmail ? ` (${profile.nylasGrantEmail})` : ""}.
                </p>
              )}
            </div>
          )}
      </ScoutBox>

      {calendarConnected && calendars.length > 0 && (
        <ScoutBox padding="24px 28px">
            <p style={sectionTitle}>Calendars for busy blocking</p>
            <p style={sectionDesc}>Kimchi checks these calendars when showing open slots.</p>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {calendars.map((cal) => (
                <label
                  key={cal.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: fontSans, fontSize: 14, color: color.stone, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCalendarIds.includes(cal.id)}
                    onChange={() => toggleCalendarId(cal.id)}
                  />
                  {cal.name}
                  {cal.isPrimary ? " (primary)" : ""}
                </label>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>Video conferencing</label>
              <select
                value={conferenceProvider}
                onChange={(e) => setConferenceProvider(e.target.value)}
                style={inputStyle}
              >
                <option value="">None — no auto-generated meeting link</option>
                <option value="google_meet">Google Meet</option>
                <option value="microsoft_teams">Microsoft Teams</option>
              </select>
            </div>
        </ScoutBox>
      )}

      <ScoutBox padding="24px 28px">
          <p style={sectionTitle}>General settings</p>
          <div style={{ marginTop: 20, display: "grid", gap: 20 }}>
            <div>
              <label style={labelStyle}>Profile visibility</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CoachStatus)}
                style={inputStyle}
              >
                <option value="ACTIVE">Taking new clients</option>
                <option value="INACTIVE">Not taking new clients</option>
                <option value="PENDING">Pending review</option>
              </select>
              <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                {status === "INACTIVE"
                  ? "Your profile will not appear in search results for new clients."
                  : status === "PENDING"
                    ? "Your profile is under review and may not appear in search yet."
                    : "Your profile is visible in the coaching directory."}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} style={inputStyle}>
                {SCHEDULER_TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>{formatTimezoneLabel(tz)}</option>
                ))}
                {!SCHEDULER_TIMEZONE_OPTIONS.includes(timezone as typeof SCHEDULER_TIMEZONE_OPTIONS[number]) && (
                  <option value={timezone}>{formatTimezoneLabel(timezone)}</option>
                )}
              </select>
            </div>
          </div>
      </ScoutBox>

      <ScoutBox padding="24px 28px">
          <p style={sectionTitle}>Default hours</p>
          <p style={sectionDesc}>Set the days and hours you are typically available for coaching.</p>
          {needsMoreHours && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.35)",
              }}
            >
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: "#b45309", lineHeight: 1.5 }}>
                In order to offer coaching on Kimchi, you need to add at least {MIN_WEEKLY_AVAILABILITY_HOURS} hours of
                weekly availability. You currently have {weeklyHoursTotal.toFixed(1)} hours.
              </p>
            </div>
          )}
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {WEEKDAY_LABELS.map(({ day, label }) => {
              const row = weeklyHours.find((r) => r.day === day)!;
              return (
                <div
                  key={day}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 16,
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: border.line,
                  }}
                >
                  <Toggle checked={row.enabled} onChange={(enabled) => updateDay(day, { enabled })} />
                  <div>
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: color.stone }}>
                      {label}
                    </p>
                    {!row.enabled && (
                      <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                        Unavailable
                      </p>
                    )}
                  </div>
                  {row.enabled ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="time"
                        value={row.start}
                        onChange={(e) => updateDay(day, { start: e.target.value })}
                        style={{ ...inputStyle, width: 120 }}
                      />
                      <span style={{ color: color.muted }}>–</span>
                      <input
                        type="time"
                        value={row.end}
                        onChange={(e) => updateDay(day, { end: e.target.value })}
                        style={{ ...inputStyle, width: 120 }}
                      />
                    </div>
                  ) : (
                    <span style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>Unavailable</span>
                  )}
                </div>
              );
            })}
          </div>
      </ScoutBox>

      <ScoutBox padding="24px 28px">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            <div>
              <p style={sectionTitle}>Conferencing</p>
              <p style={sectionDesc}>Choose your favorite conferencing tool to host your Kimchi sessions.</p>
            </div>
            <div>
              <label style={labelStyle}>Provider</label>
              <select style={inputStyle} value="kimchi-live" disabled>
                <option value="kimchi-live">Kimchi Live (built-in)</option>
              </select>
              <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                Clients will join your session via Kimchi&apos;s built-in conferencing tool.
              </p>
            </div>
          </div>
      </ScoutBox>

      <ScoutBox padding="24px 28px">
          <p style={sectionTitle}>Capacity & scheduling rules</p>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
              <div>
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.stone }}>
                  Service capacity (optional)
                </p>
                <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
                  How many hours per week do you want to spend providing services?
                </p>
              </div>
              <select
                value={capacityHours === "" ? "" : String(capacityHours)}
                onChange={(e) => setCapacityHours(e.target.value ? Number(e.target.value) : "")}
                style={inputStyle}
              >
                <option value="">Select an option…</option>
                {CAPACITY_OPTIONS.map((o) => (
                  <option key={o.hours} value={o.hours}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
              <div>
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.stone }}>
                  Advance booking window
                </p>
                <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
                  Choose how far in advance sessions must be booked.
                </p>
              </div>
              <select
                value={minBookingNoticeMinutes}
                onChange={(e) => setMinBookingNoticeMinutes(Number(e.target.value))}
                style={inputStyle}
              >
                {BOOKING_NOTICE_OPTIONS.map((o) => (
                  <option key={o.minutes} value={o.minutes}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
              <div>
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.stone }}>
                  Scheduling buffer
                </p>
                <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
                  Keep a gap between your coaching sessions.
                </p>
              </div>
              <select
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(Number(e.target.value))}
                style={inputStyle}
              >
                {BUFFER_OPTIONS.map((o) => (
                  <option key={o.minutes} value={o.minutes}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
              <div>
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.stone }}>
                  Session duration
                </p>
                <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
                  Default length for booked sessions.
                </p>
              </div>
              <input
                type="number"
                min={15}
                max={120}
                step={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.min(120, Math.max(15, Number(e.target.value) || 30)))}
                style={{ ...inputStyle, maxWidth: 140 }}
              />
            </div>

            <div>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.stone }}>
                Additional details
              </p>
              <p style={{ margin: "6px 0 10px", fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
                Add any custom availability details for clients.
              </p>
              <textarea
                value={availabilityNotes}
                onChange={(e) => setAvailabilityNotes(e.target.value.slice(0, 500))}
                placeholder="Example: I'm only taking on clients who need help in Q1 this year!"
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <p style={{ margin: "6px 0 0", fontFamily: fontMono, fontSize: 11, color: color.muted }}>
                {availabilityNotes.length}/500
              </p>
            </div>
          </div>
      </ScoutBox>

      <ScoutBox padding="24px 28px">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            <div>
              <p style={sectionTitle}>Blackout dates</p>
              <p style={sectionDesc}>
                Add dates when your availability changes from your weekly hours — vacations, holidays, or one-off blocks.
              </p>
            </div>
            <div>
              {blackoutDates.length === 0 ? (
                <div
                  style={{
                    border: `1px dashed ${border.line}`,
                    padding: "20px",
                    textAlign: "center",
                    fontFamily: fontSans,
                    fontSize: 13,
                    color: color.muted,
                    marginBottom: 12,
                  }}
                >
                  No blackout dates added yet.
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {blackoutDates.map((d) => (
                    <li
                      key={d}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        border: border.line,
                        background: "#fff",
                      }}
                    >
                      <span style={{ fontFamily: fontSans, fontSize: 14 }}>{d}</span>
                      <button
                        type="button"
                        onClick={() => setBlackoutDates((dates) => dates.filter((x) => x !== d))}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: color.muted,
                          cursor: "pointer",
                          fontFamily: fontSans,
                          fontSize: 13,
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="date"
                  value={newBlackoutDate}
                  onChange={(e) => setNewBlackoutDate(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={addBlackoutDate}
                  style={{
                    padding: "10px 14px",
                    border: border.line,
                    background: "#fff",
                    fontFamily: fontSans,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  + Add blackout date
                </button>
              </div>
            </div>
          </div>
      </ScoutBox>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <Link href={backHref} style={{ fontFamily: fontSans, fontSize: 14, color: color.forest, textDecoration: "none" }}>
          Back to Calendar
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: "12px 24px",
            background: color.forest,
            color: color.gold,
            border: border.lineStrong,
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
