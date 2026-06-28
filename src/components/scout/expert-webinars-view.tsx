"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveSessionFormat, LiveSessionStatus } from "@prisma/client";
import type { LiveSessionView } from "@/lib/live-session-types";
import { liveSessionRouteId } from "@/lib/live-sessions";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { border, color, fontSans, type as T } from "@/lib/typography";

type CoachSession = LiveSessionView & { publicPath?: string };

type CoHostDraft = { displayName: string; email: string; coachProfileId: string };

type CoachOption = { id: string; displayName: string };

const STATUS_LABEL: Record<LiveSessionStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  SCHEDULED: "Published",
  LIVE: "Live",
  ENDED: "Ended",
  CANCELLED: "Cancelled",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "var(--scout-border)",
  fontFamily: fontSans,
  fontSize: 14,
  boxSizing: "border-box",
};

function emptyForm() {
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    category: "Career Coaching",
    scheduledStart: start.toISOString().slice(0, 16),
    durationMinutes: 60,
    timezone: "America/New_York",
    format: "INTERACTIVE" as LiveSessionFormat,
    coverImageUrl: "",
    coHosts: [] as CoHostDraft[],
  };
}

export function ExpertWebinarsView() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [coHostDraft, setCoHostDraft] = useState({ displayName: "", email: "", coachProfileId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [sessRes, coachRes] = await Promise.all([
        fetch("/api/coach/live/sessions"),
        fetch("/api/coach/live/coaches"),
      ]);
      if (sessRes.ok) {
        const data = (await sessRes.json().catch(() => ({}))) as { sessions?: CoachSession[] };
        setSessions(data.sessions ?? []);
      } else {
        const data = (await sessRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not load webinars");
      }
      if (coachRes.ok) {
        const data = (await coachRes.json().catch(() => ({}))) as { coaches?: CoachOption[] };
        setCoaches(data.coaches ?? []);
      }
    } catch {
      setError("Could not load webinars");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(
    () => sessions.filter((s) => s.status === "SCHEDULED" || s.status === "LIVE" || s.status === "PENDING_APPROVAL"),
    [sessions],
  );
  const drafts = useMemo(() => sessions.filter((s) => s.status === "DRAFT"), [sessions]);
  const past = useMemo(() => sessions.filter((s) => s.status === "ENDED"), [sessions]);

  const addCoHost = () => {
    const name =
      coHostDraft.displayName.trim() ||
      coaches.find((c) => c.id === coHostDraft.coachProfileId)?.displayName ||
      "";
    if (!name) return;
    setForm((f) => ({
      ...f,
      coHosts: [
        ...f.coHosts,
        {
          displayName: name,
          email: coHostDraft.email.trim(),
          coachProfileId: coHostDraft.coachProfileId,
        },
      ],
    }));
    setCoHostDraft({ displayName: "", email: "", coachProfileId: "" });
  };

  const createWebinar = async (publish: boolean) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const start = new Date(form.scheduledStart);
      const res = await fetch("/api/coach/live/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          scheduledStart: start.toISOString(),
          durationMinutes: form.durationMinutes,
          timezone: form.timezone,
          format: form.format,
          coverImageUrl: form.coverImageUrl || null,
          coHosts: form.coHosts.map((h) => ({
            displayName: h.displayName,
            email: h.email || null,
            coachProfileId: h.coachProfileId || null,
          })),
          publish,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; session?: CoachSession };
      if (!res.ok) throw new Error(data.error ?? "Could not create webinar");
      setMessage(
        publish
          ? "Submitted for admin approval — it will appear publicly once approved."
          : "Draft saved.",
      );
      setShowForm(false);
      setForm(emptyForm());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create webinar");
    } finally {
      setBusy(false);
    }
  };

  const submitForApproval = async (session: CoachSession) => {
    setBusy(true);
    setError(null);
    try {
      const id = liveSessionRouteId(session);
      const res = await fetch(`/api/coach/live/sessions/${id}/submit`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "Submit failed");
      setMessage(data.message ?? "Submitted for approval");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleReplay = async (session: CoachSession, enabled: boolean) => {
    const id = liveSessionRouteId(session);
    const res = await fetch(`/api/coach/live/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replayEnabled: enabled }),
    });
    if (res.ok) await load();
  };

  const copyLink = (session: CoachSession) => {
    const path = session.publicPath ?? `/live/${liveSessionRouteId(session)}`;
    const url = `${window.location.origin}${path}`;
    void navigator.clipboard.writeText(url);
    setMessage("Link copied to clipboard");
  };

  const startSession = async (session: CoachSession) => {
    const id = liveSessionRouteId(session);
    setBusy(true);
    try {
      const res = await fetch("/api/live/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id, action: "go-live" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not start");
      window.location.href = `/live/${id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session");
      setBusy(false);
    }
  };

  function SessionCard({ session }: { session: CoachSession }) {
    const routeId = liveSessionRouteId(session);
    const canStart = session.status === "SCHEDULED" || session.status === "LIVE";
    return (
      <ScoutBox padding={18}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 11, fontWeight: 600, color: color.forest, textTransform: "uppercase" }}>
              {STATUS_LABEL[session.status]} · {session.format === "BROADCAST" ? "Broadcast" : "Interactive"}
            </p>
            <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 17, fontWeight: 600 }}>{session.title}</p>
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted }}>
              {session.date} · {session.registered} registered
            </p>
            {session.rejectionReason && (
              <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: 13, color: "#b42318" }}>
                Feedback: {session.rejectionReason}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            {(session.status === "DRAFT" || session.status === "SCHEDULED") && (
              <ScoutSecondaryBtn type="button" disabled={busy} onClick={() => void submitForApproval(session)}>
                Submit for approval
              </ScoutSecondaryBtn>
            )}
            <ScoutSecondaryBtn type="button" onClick={() => copyLink(session)}>
              Copy link
            </ScoutSecondaryBtn>
            {session.status === "SCHEDULED" && (
              <Link href={`/live/${routeId}`} style={{ textDecoration: "none" }}>
                <ScoutSecondaryBtn type="button">Preview</ScoutSecondaryBtn>
              </Link>
            )}
            {canStart && (
              <ScoutPrimaryBtn type="button" disabled={busy} onClick={() => void startSession(session)}>
                {session.isLive ? "Join live" : "Go live"}
              </ScoutPrimaryBtn>
            )}
            {session.status === "ENDED" && session.recordingUrl && (
              <ScoutSecondaryBtn
                type="button"
                onClick={() => void toggleReplay(session, !session.replayEnabled)}
              >
                {session.replayEnabled ? "Disable replay" : "Enable replay"}
              </ScoutSecondaryBtn>
            )}
          </div>
        </div>
      </ScoutBox>
    );
  }

  return (
    <div style={{ padding: isMobile ? "0 0 32px" : "0 0 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, maxWidth: 520, lineHeight: 1.55 }}>
          Create webinars, submit for admin approval, then share the public link. Choose interactive (everyone on camera) or broadcast (viewers watch HLS).
        </p>
        <ScoutPrimaryBtn type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close form" : "Create webinar"}
        </ScoutPrimaryBtn>
      </div>

      {message && <p style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, marginBottom: 12 }}>{message}</p>}
      {error && <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b42318", marginBottom: 12 }}>{error}</p>}

      {showForm && (
        <ScoutBox padding={20} style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontFamily: fontSans, fontSize: 18, fontWeight: 600 }}>New webinar</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <input style={inputStyle} placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea
              style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
              placeholder="Description — what attendees will learn"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
              <label style={{ fontFamily: fontSans, fontSize: 13 }}>
                Start
                <input type="datetime-local" style={{ ...inputStyle, marginTop: 6 }} value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} />
              </label>
              <label style={{ fontFamily: fontSans, fontSize: 13 }}>
                Duration (min)
                <input type="number" min={15} step={15} style={{ ...inputStyle, marginTop: 6 }} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
              </label>
              <label style={{ fontFamily: fontSans, fontSize: 13 }}>
                Timezone
                <input style={{ ...inputStyle, marginTop: 6 }} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["INTERACTIVE", "BROADCAST"] as LiveSessionFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForm({ ...form, format: f })}
                  style={{
                    padding: "8px 14px",
                    border: form.format === f ? `2px solid ${color.forest}` : "var(--scout-border)",
                    background: form.format === f ? "rgba(26,58,47,0.06)" : "#fff",
                    fontFamily: fontSans,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {f === "INTERACTIVE" ? "Interactive" : "Broadcast"}
                </button>
              ))}
            </div>
            <input style={inputStyle} placeholder="Cover image URL (optional)" value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} />

            <div>
              <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Co-hosts</p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <select
                  style={inputStyle}
                  value={coHostDraft.coachProfileId}
                  onChange={(e) => setCoHostDraft({ ...coHostDraft, coachProfileId: e.target.value })}
                >
                  <option value="">Other coach (optional)</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>{c.displayName}</option>
                  ))}
                </select>
                <input style={inputStyle} placeholder="Name" value={coHostDraft.displayName} onChange={(e) => setCoHostDraft({ ...coHostDraft, displayName: e.target.value })} />
                <input style={inputStyle} placeholder="Email (optional)" value={coHostDraft.email} onChange={(e) => setCoHostDraft({ ...coHostDraft, email: e.target.value })} />
                <ScoutSecondaryBtn type="button" onClick={addCoHost}>Add</ScoutSecondaryBtn>
              </div>
              {form.coHosts.length > 0 && (
                <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontFamily: fontSans, fontSize: 13 }}>
                  {form.coHosts.map((h, i) => (
                    <li key={`${h.displayName}-${i}`}>{h.displayName}{h.email ? ` (${h.email})` : ""}</li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ScoutSecondaryBtn type="button" disabled={busy} onClick={() => void createWebinar(false)}>
                Save draft
              </ScoutSecondaryBtn>
              <ScoutPrimaryBtn type="button" disabled={busy} onClick={() => void createWebinar(true)}>
                Submit for approval
              </ScoutPrimaryBtn>
            </div>
          </div>
        </ScoutBox>
      )}

      {loading ? (
        <p style={{ fontFamily: fontSans, color: color.muted }}>Loading your webinars…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {upcoming.length > 0 && (
            <section>
              <h3 style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 15, fontWeight: 600 }}>Upcoming</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {upcoming.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </section>
          )}
          {drafts.length > 0 && (
            <section>
              <h3 style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 15, fontWeight: 600 }}>Drafts</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {drafts.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h3 style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: 15, fontWeight: 600 }}>Past sessions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {past.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </section>
          )}
          {sessions.length === 0 && (
            <ScoutBox padding={24}>
              <p style={{ margin: 0, fontFamily: fontSans, color: color.muted }}>No webinars yet — create your first one above.</p>
            </ScoutBox>
          )}
        </div>
      )}
    </div>
  );
}
