"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";
import type { LiveSessionView } from "@/lib/live-session-types";

type RoomStatus = {
  roomId: string | null;
  roomEnabled: boolean;
  activePeerCount: number;
  isActive: boolean;
  peers?: Array<{ id: string; name: string; role: string }>;
};

type AdminLiveSession = LiveSessionView & {
  room: RoomStatus | null;
  activePeers: Array<{ id: string; name: string; role: string }>;
};

type CoachOption = { id: string; displayName: string; headline: string | null };

type AdminLiveResponse = {
  hmsConfigured: boolean;
  overview: {
    liveNowCount: number;
    scheduledCount: number;
    totalRegistrations: number;
    activeAttendees: number;
  };
  sessions: AdminLiveSession[];
  hostRoles: { host: string; guest: string };
};

type SessionAnalytics = {
  peakViewers: number;
  totalUniqueJoins: number;
  registered: number;
  joined: number;
  conversionPct: number;
  recordingUrl: string | null;
  hlsPlaybackUrl: string | null;
  eventCounts: Record<string, number>;
};

type EditForm = {
  title: string;
  description: string;
  category: string;
  scheduledStart: string;
  scheduledEnd: string;
  isFeaturedWeekly: boolean;
  status: string;
};

type RegistrationRow = {
  id: string;
  name: string | null;
  email: string;
  registeredAt: string;
  joinedAt: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: border.line,
  fontFamily: fontSans,
  fontSize: T.bodySm,
  background: surface.card,
  boxSizing: "border-box",
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <ScoutBox padding={16}>
      <p style={{ fontFamily: fontMono, fontSize: 11, color: color.muted, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </p>
      <p style={{ fontFamily: fontSans, fontSize: 28, fontWeight: 700, margin: 0, color: color.ink }}>{value}</p>
    </ScoutBox>
  );
}

export function LiveSessionsAdminPanel() {
  const router = useRouter();
  const [data, setData] = useState<AdminLiveResponse | null>(null);
  const [platformAnalytics, setPlatformAnalytics] = useState<{
    sessionsLast30Days: number;
    avgPeakViewers: number;
    eventTotals: Record<string, number>;
  } | null>(null);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "General",
    coachProfileId: "",
    scheduledStart: "",
    scheduledEnd: "",
    isFeaturedWeekly: false,
  });

  const load = useCallback(async () => {
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
    fetch("/api/admin/live/sessions/platform/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPlatformAnalytics(d))
      .catch(() => {});
    fetch("/api/admin/live/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCoaches(d?.coaches ?? []))
      .catch(() => {});
    const intervalMs = data?.overview?.liveNowCount ? 5000 : 30000;
    const interval = window.setInterval(() => void load(), intervalMs);
    return () => window.clearInterval(interval);
  }, [load, data?.overview?.liveNowCount]);

  const loadSessionDetail = async (sessionId: string) => {
    const res = await fetch(`/api/admin/live?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) return;
    const d = (await res.json()) as { registrations: RegistrationRow[] };
    setRegistrations(d.registrations ?? []);

    const analyticsRes = await fetch(
      `/api/admin/live/sessions/${encodeURIComponent(sessionId)}/analytics`,
    );
    if (analyticsRes.ok) {
      setAnalytics((await analyticsRes.json()) as SessionAnalytics);
    }
  };

  const runAction = async (sessionId: string, action: "go-live" | "end" | "enable-room" | "disable-room") => {
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
      if (expandedId === sessionId) await loadSessionDetail(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const createSession = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/live/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          coachProfileId: form.coachProfileId,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not create session");
      setForm({
        title: "",
        description: "",
        category: "General",
        coachProfileId: "",
        scheduledStart: "",
        scheduledEnd: "",
        isFeaturedWeekly: false,
      });
      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create session");
    } finally {
      setCreating(false);
    }
  };

  const grouped = useMemo(() => {
    const sessions = data?.sessions ?? [];
    return {
      live: sessions.filter((s) => s.status === "LIVE"),
      pending: sessions.filter((s) => s.status === "PENDING_APPROVAL"),
      upcoming: sessions.filter((s) => s.status === "SCHEDULED" || s.status === "DRAFT"),
      past: sessions.filter((s) => s.status === "ENDED" || s.status === "CANCELLED"),
    };
  }, [data?.sessions]);

  const toggleExpand = (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      setRegistrations([]);
      setAnalytics(null);
      setEditingId(null);
      setEditForm(null);
      return;
    }
    setExpandedId(sessionId);
    void loadSessionDetail(sessionId);
  };

  const startEdit = (session: AdminLiveSession) => {
    setEditingId(session.id);
    setEditForm({
      title: session.title,
      description: session.description,
      category: session.category,
      scheduledStart: session.scheduledStart.slice(0, 16),
      scheduledEnd: session.scheduledEnd.slice(0, 16),
      isFeaturedWeekly: session.isFeaturedWeekly,
      status: session.status,
    });
  };

  const saveEdit = async (sessionId: string) => {
    if (!editForm) return;
    setBusyId(sessionId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/live/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not update session");
      setEditingId(null);
      setEditForm(null);
      await load();
      if (expandedId === sessionId) await loadSessionDetail(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update session");
    } finally {
      setBusyId(null);
    }
  };

  const runApproval = async (sessionId: string, action: "approve" | "reject") => {
    setBusyId(sessionId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/live/sessions/${sessionId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason: "Please revise and resubmit." }) : "{}",
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

  const renderSession = (session: AdminLiveSession) => (
    <ScoutBox key={session.id} padding={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: border.line }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p style={{ fontFamily: fontMono, fontSize: 11, color: color.muted, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {session.category} · {session.registered} registered
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
                background: session.status === "LIVE" ? "#C4574A" : session.status === "SCHEDULED" ? color.forest : color.muted,
                color: session.status === "LIVE" || session.status === "SCHEDULED" ? "#fff" : color.ink,
                fontFamily: fontSans,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {session.status === "LIVE" ? "● Live" : session.status}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
            fontFamily: fontSans,
            fontSize: T.caption,
            color: color.stone,
          }}
        >
          <div><strong>In room now</strong><br />{session.room?.activePeerCount ?? 0}</div>
          <div><strong>Room</strong><br />{session.room?.roomEnabled === false ? "Locked" : session.room?.roomId ? "Ready" : "Not created"}</div>
          <div><strong>Attendee link</strong><br /><code style={{ fontFamily: fontMono, fontSize: 10 }}>/live/{session.legacyNumericId ?? session.id.slice(0, 8)}</code></div>
        </div>

        {session.activePeers.length > 0 && (
          <div style={{ padding: "10px 12px", background: surface.inset, border: border.line }}>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, margin: "0 0 8px" }}>Who&apos;s in the room</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.caption, lineHeight: 1.6 }}>
              {session.activePeers.map((p) => (
                <li key={p.id}>{p.name} <span style={{ color: color.muted }}>({p.role})</span></li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(session.status === "PENDING_APPROVAL" || session.status === "DRAFT") && (
            <>
              <ScoutPrimaryBtn
                disabled={busyId === session.id}
                onClick={() => void runApproval(String(session.legacyNumericId ?? session.id), "approve")}
                style={{ minHeight: 40 }}
              >
                Approve & publish
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn
                disabled={busyId === session.id}
                onClick={() => void runApproval(String(session.legacyNumericId ?? session.id), "reject")}
                style={{ minHeight: 40 }}
              >
                Send back
              </ScoutSecondaryBtn>
            </>
          )}
          {session.status !== "LIVE" && (
            <ScoutPrimaryBtn
              disabled={busyId === session.id || !data?.hmsConfigured}
              onClick={() => void runAction(session.id, "go-live")}
              style={{ minHeight: 40 }}
            >
              {busyId === session.id ? "Working…" : "Go live"}
            </ScoutPrimaryBtn>
          )}
          {session.status === "LIVE" && (
            <ScoutSecondaryBtn
              disabled={busyId === session.id || !data?.hmsConfigured}
              onClick={() => void runAction(session.id, "end")}
              style={{ minHeight: 40 }}
            >
              End session
            </ScoutSecondaryBtn>
          )}
          <ScoutSecondaryBtn disabled={!data?.hmsConfigured} onClick={() => router.push(`/live/${session.legacyNumericId ?? session.id}`)} style={{ minHeight: 40 }}>
            Join as host →
          </ScoutSecondaryBtn>
          <ScoutSecondaryBtn disabled={!data?.hmsConfigured} onClick={() => router.push(`/live/${session.legacyNumericId ?? session.id}?as=guest`)} style={{ minHeight: 40 }}>
            Preview as guest →
          </ScoutSecondaryBtn>
          <ScoutSecondaryBtn onClick={() => toggleExpand(session.id)} style={{ minHeight: 40 }}>
            {expandedId === session.id ? "Hide details" : "Details & analytics"}
          </ScoutSecondaryBtn>
          <ScoutSecondaryBtn
            onClick={() => {
              if (editingId === session.id) {
                setEditingId(null);
                setEditForm(null);
              } else {
                startEdit(session);
                if (expandedId !== session.id) toggleExpand(session.id);
              }
            }}
            style={{ minHeight: 40 }}
          >
            {editingId === session.id ? "Cancel edit" : "Edit session"}
          </ScoutSecondaryBtn>
          <ScoutSecondaryBtn
            onClick={() => {
              window.open(
                `/api/admin/live/sessions/${session.legacyNumericId ?? session.id}/export`,
                "_blank",
              );
            }}
            style={{ minHeight: 40 }}
          >
            Export RSVPs (CSV)
          </ScoutSecondaryBtn>
          {(session.recordingUrl || session.hlsPlaybackUrl) && (
            <ScoutSecondaryBtn
              onClick={() =>
                router.push(`/live/${session.legacyNumericId ?? session.id}/replay`)
              }
              style={{ minHeight: 40 }}
            >
              View replay →
            </ScoutSecondaryBtn>
          )}
        </div>

        {editingId === session.id && editForm && (
          <div style={{ borderTop: border.line, paddingTop: 12, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Title</span>
              <input style={inputStyle} value={editForm.title} onChange={(e) => setEditForm((f) => f && ({ ...f, title: e.target.value }))} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Description</span>
              <textarea style={{ ...inputStyle, minHeight: 60 }} value={editForm.description} onChange={(e) => setEditForm((f) => f && ({ ...f, description: e.target.value }))} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Starts</span>
                <input type="datetime-local" style={inputStyle} value={editForm.scheduledStart} onChange={(e) => setEditForm((f) => f && ({ ...f, scheduledStart: e.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Ends</span>
                <input type="datetime-local" style={inputStyle} value={editForm.scheduledEnd} onChange={(e) => setEditForm((f) => f && ({ ...f, scheduledEnd: e.target.value }))} />
              </label>
            </div>
            <ScoutPrimaryBtn disabled={busyId === session.id} onClick={() => void saveEdit(session.id)} style={{ width: "fit-content", minHeight: 40 }}>
              Save changes
            </ScoutPrimaryBtn>
          </div>
        )}

        {expandedId === session.id && analytics && (
          <div style={{ borderTop: border.line, paddingTop: 12 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, margin: "0 0 10px" }}>
              Session analytics
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 12 }}>
              <StatCard label="Peak viewers" value={analytics.peakViewers} />
              <StatCard label="Unique joins" value={analytics.totalUniqueJoins} />
              <StatCard label="RSVP → join" value={`${analytics.conversionPct}%`} />
            </div>
            {analytics.hlsPlaybackUrl && (
              <p style={{ fontFamily: fontMono, fontSize: 10, color: color.muted, margin: "0 0 8px", wordBreak: "break-all" }}>
                HLS: {analytics.hlsPlaybackUrl}
              </p>
            )}
          </div>
        )}

        {expandedId === session.id && (
          <div style={{ borderTop: border.line, paddingTop: 12 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, margin: "0 0 8px" }}>
              Registrations ({registrations.length})
            </p>
            {registrations.length === 0 ? (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>No one registered yet.</p>
            ) : (
              <div style={{ maxHeight: 200, overflow: "auto", border: border.line }}>
                {registrations.map((r) => (
                  <div key={r.id} style={{ padding: "8px 12px", borderBottom: border.line, fontFamily: fontSans, fontSize: T.caption }}>
                    <strong>{r.name ?? "—"}</strong> · {r.email}
                    <span style={{ color: color.muted, marginLeft: 8 }}>
                      {r.joinedAt ? "Joined" : "Registered"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ScoutBox>
  );

  return (
    <div>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 20px", lineHeight: 1.6 }}>
        Create sessions, go live, monitor analytics, and join any room as host or guest. RSVP emails, reminders, follower alerts, and post-session follow-ups are automated.
      </p>

      {platformAnalytics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatCard label="Sessions (30d)" value={platformAnalytics.sessionsLast30Days} />
          <StatCard label="Avg peak viewers" value={platformAnalytics.avgPeakViewers} />
          <StatCard label="Total joins" value={platformAnalytics.eventTotals.JOINED ?? 0} />
        </div>
      )}

      {data?.overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatCard label="Live now" value={data.overview.liveNowCount} />
          <StatCard label="In rooms" value={data.overview.activeAttendees} />
          <StatCard label="Scheduled" value={data.overview.scheduledCount} />
          <StatCard label="Total RSVPs" value={data.overview.totalRegistrations} />
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <ScoutSecondaryBtn onClick={() => setShowCreate((v) => !v)} style={{ minHeight: 40 }}>
          {showCreate ? "Cancel" : "+ New session"}
        </ScoutSecondaryBtn>
      </div>

      {showCreate && (
        <ScoutBox padding={20} style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>New live session</h3>
          <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Title</span>
              <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Description</span>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Coach (host) *</span>
              <select required style={inputStyle} value={form.coachProfileId} onChange={(e) => setForm((f) => ({ ...f, coachProfileId: e.target.value }))}>
                <option value="">— Select coach —</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName}{c.headline ? ` · ${c.headline}` : ""}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Starts</span>
                <input type="datetime-local" style={inputStyle} value={form.scheduledStart} onChange={(e) => setForm((f) => ({ ...f, scheduledStart: e.target.value }))} />
              </label>
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600 }}>Ends</span>
                <input type="datetime-local" style={inputStyle} value={form.scheduledEnd} onChange={(e) => setForm((f) => ({ ...f, scheduledEnd: e.target.value }))} />
              </label>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fontSans, fontSize: T.caption }}>
              <input type="checkbox" checked={form.isFeaturedWeekly} onChange={(e) => setForm((f) => ({ ...f, isFeaturedWeekly: e.target.checked }))} />
              Feature as weekly session on Live page
            </label>
            <ScoutPrimaryBtn disabled={creating} onClick={() => void createSession()} style={{ width: "fit-content", minHeight: 40 }}>
              {creating ? "Creating…" : "Create session"}
            </ScoutPrimaryBtn>
          </div>
        </ScoutBox>
      )}

      {!data?.hmsConfigured && (
        <ScoutBox padding={16} style={{ marginBottom: 16, background: "rgba(196,87,74,0.08)", borderColor: "#C4574A" }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#8B3A32", margin: 0 }}>
            100ms is not configured. Set <code>HMS_ACCESS_KEY</code> and <code>HMS_SECRET</code> in Vercel.
          </p>
        </ScoutBox>
      )}

      {loading && <p style={{ fontFamily: fontSans, color: color.muted }}>Loading sessions…</p>}
      {error && <p style={{ fontFamily: fontSans, color: "#dc2626", marginBottom: 16 }}>{error}</p>}

      {!loading && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {grouped.live.length > 0 && (
            <section>
              <h3 style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: "#C4574A" }}>● Live now</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{grouped.live.map(renderSession)}</div>
            </section>
          )}
          {grouped.pending.length > 0 && (
            <section>
              <h3 style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: color.forest }}>Awaiting approval</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{grouped.pending.map(renderSession)}</div>
            </section>
          )}
          {grouped.upcoming.length > 0 && (
            <section>
              <h3 style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Upcoming</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{grouped.upcoming.map(renderSession)}</div>
            </section>
          )}
          {grouped.past.length > 0 && (
            <section>
              <h3 style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: color.muted }}>Past</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{grouped.past.map(renderSession)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminLivePageHeader() {
  return <h1 style={{ ...displayTitleStyle(28), margin: "0 0 8px" }}>Live sessions</h1>;
}
