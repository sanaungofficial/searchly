"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSubscription } from "@/hooks/useSubscription";
import {
  DASHBOARD_GOAL_MAX,
  DASHBOARD_GOAL_OPTIONS,
  type DashboardGoal,
  dashboardGoalCategoryLabel,
  findDashboardGoalOption,
  formatGoalTargetDate,
  profileNeedsSyncForGoal,
  recommendationLabelForGoals,
  recommendationPathForGoals,
  SALES_TEAM_FORM_URL,
} from "@/lib/dashboard-goals";
import { formatBookingWhen } from "@/lib/coach-user-booking";
import { isStaffPortalRole } from "@/lib/staff-portal";
import type { LiveSessionView } from "@/lib/live-session-types";
import { liveSessionRouteId } from "@/lib/live-sessions";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { EventInterestModal } from "@/components/scout/event-interest-modal";
import { GrowthDiscoveryModal } from "@/components/scout/growth-discovery-modal";
import { ProfileSyncPromptModal } from "@/components/scout/profile-sync-prompt-modal";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  isMobile: boolean;
};

type ProfileData = {
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  summary: string | null;
  jobTimeline: string | null;
  careerMotivation: string | null;
  employmentStatus: string | null;
  dashboardGoals: DashboardGoal[];
};

const CARD: React.CSSProperties = {
  background: surface.card,
  border: border.line,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function shortBio(profile: ProfileData | null): string | null {
  if (!profile) return null;
  if (profile.headline?.trim()) return profile.headline.trim();
  if (profile.summary?.trim()) {
    const s = profile.summary.trim();
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  }
  return null;
}

type BookedCoach = {
  bookingId: string;
  nylasBookingRef: string | null;
  startAt: string;
  endAt: string;
  status: string;
  title: string | null;
  coach: {
    id: string;
    slug: string | null;
    displayName: string;
    photoUrl: string | null;
    headline: string | null;
  };
};

export function DashboardHomeTop({ isMobile }: Props) {
  const router = useRouter();
  const { openPricing, userRole } = useWorkspace();
  const isStaffPortal = isStaffPortalRole(userRole);
  const { isPro, loading: subLoading } = useSubscription();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [pickValue, setPickValue] = useState("");
  const [pickTargetMonth, setPickTargetMonth] = useState("");
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editTargetMonth, setEditTargetMonth] = useState("");
  const [bookedCoach, setBookedCoach] = useState<BookedCoach | null>(null);
  const [bookingLoading, setBookingLoading] = useState(true);
  const [pendingSync, setPendingSync] = useState<ReturnType<typeof profileNeedsSyncForGoal>>(null);
  const [syncSaving, setSyncSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);

  const [allSessions, setAllSessions] = useState<LiveSessionView[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [registerBusyId, setRegisterBusyId] = useState<string | null>(null);
  const eventsScrollRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(() => {
    setLoading(true);
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.error) return;
        setProfile({
          name: data.name ?? "You",
          avatarUrl: data.avatarUrl ?? null,
          headline: data.headline ?? null,
          summary: data.summary ?? null,
          jobTimeline: data.jobTimeline ?? null,
          careerMotivation: data.careerMotivation ?? null,
          employmentStatus: data.employmentStatus ?? null,
          dashboardGoals: data.dashboardGoals ?? [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    fetch("/api/live/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.sessions)) setAllSessions(d.sessions);
      })
      .catch(() => {})
      .finally(() => setSessionsLoaded(true));
  }, []);

  useEffect(() => {
    if (isStaffPortal) {
      setBookedCoach(null);
      setBookingLoading(false);
      return;
    }

    setBookingLoading(true);
    fetch("/api/bookings/me?upcoming=true&limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (d) => {
        let row = d?.bookings?.[0];
        if (!row) {
          const pastRes = await fetch("/api/bookings/me?upcoming=false&limit=1");
          const pastData = pastRes.ok ? await pastRes.json() : null;
          row = pastData?.bookings?.[0];
        }
        if (!row) {
          setBookedCoach(null);
          return;
        }
        setBookedCoach({
          bookingId: row.id,
          nylasBookingRef: row.nylasBookingRef ?? null,
          startAt: row.startAt,
          endAt: row.endAt,
          status: row.status,
          title: row.title ?? null,
          coach: {
            id: row.coachProfileId,
            slug: row.coachSlug ?? null,
            displayName: row.coachName,
            photoUrl: row.coachPhotoUrl ?? null,
            headline: null,
          },
        });
      })
      .catch(() => setBookedCoach(null))
      .finally(() => setBookingLoading(false));
  }, [isStaffPortal]);

  const goals = profile?.dashboardGoals ?? [];
  const usedValues = useMemo(() => new Set(goals.map((g) => g.value)), [goals]);
  const availableOptions = DASHBOARD_GOAL_OPTIONS.filter((o) => !usedValues.has(o.value));
  const canAdd = goals.length < DASHBOARD_GOAL_MAX && availableOptions.length > 0;

  const eventSessions = useMemo(() => {
    const live = allSessions.filter((s) => s.isLive);
    const upcoming = allSessions.filter(
      (s) => !s.isLive && s.status !== "ENDED" && s.status !== "CANCELLED",
    );
    return [...live, ...upcoming].slice(0, 8);
  }, [allSessions]);

  const reloadSessions = useCallback(() => {
    return fetch("/api/live/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.sessions)) setAllSessions(d.sessions);
      })
      .catch(() => {});
  }, []);

  const registerForSession = async (session: LiveSessionView) => {
    const routeId = liveSessionRouteId(session);
    setRegisterBusyId(session.id);
    try {
      const res = await fetch("/api/live/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: routeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not register");
      await reloadSessions();
    } catch {
      // Registration errors are non-blocking on the dashboard carousel
    } finally {
      setRegisterBusyId(null);
    }
  };

  const persistGoals = async (next: DashboardGoal[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardGoals: next }),
      });
      if (res.ok) {
        setProfile((p) => (p ? { ...p, dashboardGoals: next } : p));
      }
    } finally {
      setSaving(false);
    }
  };

  const addGoal = async () => {
    const option = findDashboardGoalOption(pickValue);
    if (!option || !profile || usedValues.has(option.value) || goals.length >= DASHBOARD_GOAL_MAX) return;

    const next: DashboardGoal = {
      id: crypto.randomUUID(),
      category: option.category,
      value: option.value,
      label: option.label,
      createdAt: new Date().toISOString(),
      ...(pickTargetMonth.trim() ? { targetDate: pickTargetMonth.trim().slice(0, 7) } : {}),
    };
    await persistGoals([...goals, next]);
    setPickValue("");
    setPickTargetMonth("");
    setShowAddGoal(false);

    const sync = profileNeedsSyncForGoal(option.value, profile);
    if (sync) setPendingSync(sync);
  };

  const removeGoal = (id: string) => {
    persistGoals(goals.filter((g) => g.id !== id));
  };

  const updateGoalTarget = async (id: string, targetDate: string | null) => {
    const next = goals.map((g) =>
      g.id === id ? { ...g, targetDate: targetDate?.trim().slice(0, 7) || null } : g,
    );
    await persistGoals(next);
    setEditingTargetId(null);
    setEditTargetMonth("");
  };

  const openCoachProfile = (slug: string | null, coachId: string) => {
    if (slug) router.push(`/coaching/coach/${slug}`);
    else router.push("/coaching");
  };

  const handleScheduleCall = () => {
    if (SALES_TEAM_FORM_URL) {
      window.open(SALES_TEAM_FORM_URL, "_blank", "noopener,noreferrer");
      return;
    }
    setScheduleOpen(true);
  };

  const handleRecommendation = () => {
    if (goals.length === 0) {
      router.push("/coaching");
      return;
    }
    router.push(recommendationPathForGoals(goals));
  };

  const recommendationLabel =
    goals.length > 0 ? recommendationLabelForGoals(goals) : "Get recommendations";

  const confirmProfileSync = async () => {
    if (!pendingSync) return;
    setSyncSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [pendingSync.field]: pendingSync.suggestedValue }),
      });
      if (res.ok && profile) {
        setProfile({ ...profile, [pendingSync.field]: pendingSync.suggestedValue });
      }
    } finally {
      setSyncSaving(false);
      setPendingSync(null);
    }
  };

  const scrollEvents = (dir: -1 | 1) => {
    eventsScrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  const bio = shortBio(profile);
  const showProPromo = !subLoading && !isPro;

  const leftColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Profile card */}
      <div style={{ ...CARD, padding: isMobile ? "20px 18px" : "24px 22px", position: "relative" }}>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          aria-label="Edit profile"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 32,
            height: 32,
            border: border.line,
            background: surface.inset,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color.muted,
          }}
        >
          ✎
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              style={{
                width: isMobile ? 88 : 108,
                height: isMobile ? 88 : 108,
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: 14,
              }}
            />
          ) : (
            <div
              style={{
                width: isMobile ? 88 : 108,
                height: isMobile ? 88 : 108,
                borderRadius: "50%",
                background: color.cream,
                border: border.line,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
                fontFamily: fontSans,
                fontSize: 28,
                fontWeight: 600,
                color: color.forest,
              }}
            >
              {profile ? initials(profile.name) : "…"}
            </div>
          )}
          <p style={{ fontFamily: fontSans, fontSize: T.heading, fontWeight: 600, color: color.ink, margin: "0 0 8px" }}>
            {loading ? "…" : profile?.name ?? "You"}
          </p>
          {bio ? (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: 0 }}>
              {bio}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/profile")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.muted,
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
                textUnderlineOffset: 3,
              }}
            >
              Add a bio
            </button>
          )}
        </div>
      </div>

      {/* Kimchi Pro promo */}
      {showProPromo && (
        <div
          style={{
            ...CARD,
            padding: "18px 20px",
            background: "linear-gradient(135deg, rgba(45,31,82,0.06) 0%, rgba(26,58,47,0.08) 100%)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.forest, margin: "0 0 6px" }}>
            🔒 Kimchi Pro
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.55, margin: "0 0 14px", maxWidth: 260 }}>
            Unlimited AI tailoring, coach rates, and priority support.
          </p>
          <ScoutSecondaryBtn onClick={openPricing} style={{ minHeight: 38, fontSize: T.caption }}>
            Check it out
          </ScoutSecondaryBtn>
        </div>
      )}

      {/* Goals card */}
      <div style={{ ...CARD, padding: isMobile ? "16px 18px" : "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: 0 }}>
            Your goals
          </p>
          {canAdd && (
            <button
              type="button"
              onClick={() => setShowAddGoal((v) => !v)}
              aria-label="Add goal"
              style={{
                width: 28,
                height: 28,
                border: border.line,
                background: surface.inset,
                cursor: "pointer",
                fontFamily: fontSans,
                fontSize: 18,
                lineHeight: 1,
                color: color.forest,
              }}
            >
              +
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>Loading…</p>
        ) : goals.length === 0 && !showAddGoal ? (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.55, margin: "0 0 14px" }}>
            What are you working toward? Add up to {DASHBOARD_GOAL_MAX} outcomes.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: showAddGoal || canAdd ? 14 : 0 }}>
            {goals.map((goal) => {
              const targetLabel = formatGoalTargetDate(goal.targetDate);
              const isEditingTarget = editingTargetId === goal.id;
              return (
              <div key={goal.id} style={{ borderBottom: border.line, paddingBottom: 12 }}>
                {targetLabel && (
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>
                    {targetLabel}
                  </p>
                )}
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 8px", lineHeight: 1.4 }}>
                  {goal.label}
                </p>
                {isEditingTarget ? (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <input
                      type="month"
                      value={editTargetMonth}
                      onChange={(e) => setEditTargetMonth(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 140,
                        padding: "8px 10px",
                        border: border.line,
                        fontFamily: fontSans,
                        fontSize: isMobile ? 16 : T.bodySm,
                      }}
                    />
                    <ScoutSecondaryBtn
                      onClick={() => updateGoalTarget(goal.id, editTargetMonth || null)}
                      disabled={saving}
                      style={{ minHeight: 36 }}
                    >
                      Save
                    </ScoutSecondaryBtn>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTargetId(null);
                        setEditTargetMonth("");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        color: color.muted,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.label,
                      color: color.muted,
                      background: surface.inset,
                      padding: "4px 8px",
                      border: border.line,
                    }}
                  >
                    {dashboardGoalCategoryLabel(goal.category)}
                  </span>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTargetId(goal.id);
                        setEditTargetMonth(goal.targetDate ?? "");
                      }}
                      disabled={saving}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        color: color.forest,
                        cursor: saving ? "default" : "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGoal(goal.id)}
                      disabled={saving}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        color: color.muted,
                        cursor: saving ? "default" : "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {(showAddGoal || (goals.length === 0 && canAdd)) && (
          <div style={{ marginBottom: 14 }}>
            <select
              value={pickValue}
              onChange={(e) => setPickValue(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 10px",
                border: border.line,
                background: surface.card,
                fontFamily: fontSans,
                fontSize: isMobile ? 16 : T.bodySm,
                color: color.ink,
                marginBottom: 8,
              }}
            >
              <option value="">Choose an outcome…</option>
              {(["job_search", "coaching", "career"] as const).map((cat) => {
                const opts = availableOptions.filter((o) => o.category === cat);
                if (opts.length === 0) return null;
                return (
                  <optgroup key={cat} label={dashboardGoalCategoryLabel(cat)}>
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, color: color.muted, marginBottom: 6 }}>
              Target date (optional)
            </label>
            <input
              type="month"
              value={pickTargetMonth}
              onChange={(e) => setPickTargetMonth(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 10px",
                border: border.line,
                background: surface.card,
                fontFamily: fontSans,
                fontSize: isMobile ? 16 : T.bodySm,
                color: color.ink,
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            />
            <ScoutSecondaryBtn
              onClick={addGoal}
              disabled={!pickValue || saving}
              style={{ width: "100%", minHeight: 40 }}
            >
              {saving ? "Saving…" : "Save goal"}
            </ScoutSecondaryBtn>
          </div>
        )}

        {canAdd && !showAddGoal && goals.length > 0 && (
          <ScoutPrimaryBtn
            onClick={() => setShowAddGoal(true)}
            style={{ width: "100%", minHeight: 42 }}
          >
            Add your outcome
          </ScoutPrimaryBtn>
        )}
      </div>
    </div>
  );

  const rightColumn = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      {/* Coach status — seekers only */}
      {!isStaffPortal && !bookingLoading && !bookedCoach && (
        <div
          style={{
            ...CARD,
            padding: isMobile ? "16px 18px" : "18px 22px",
            borderStyle: "dashed",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: 0, flex: 1 }}>
            You don&apos;t have a coach yet. Search experts to find your perfect match.
          </p>
          <ScoutSecondaryBtn onClick={() => router.push("/coaching")} style={{ minHeight: 40, flexShrink: 0 }}>
            Browse coaches
          </ScoutSecondaryBtn>
        </div>
      )}

      {!isStaffPortal && !bookingLoading && bookedCoach && (
        <div
          style={{
            ...CARD,
            padding: isMobile ? "16px 18px" : "18px 22px",
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            gap: 14,
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
            <CoachAvatar name={bookedCoach.coach.displayName} photoUrl={bookedCoach.coach.photoUrl} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>
                Your coach
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>
                {bookedCoach.coach.displayName}
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                {new Date(bookedCoach.startAt) >= new Date()
                  ? `Next session · ${formatBookingWhen(bookedCoach.startAt)}`
                  : `Last session · ${formatBookingWhen(bookedCoach.startAt)}`}
              </p>
            </div>
          </div>
          <ScoutSecondaryBtn
            onClick={() => openCoachProfile(bookedCoach.coach.slug, bookedCoach.coach.id)}
            style={{ minHeight: 40, flexShrink: 0, width: isMobile ? "100%" : undefined }}
          >
            View coach →
          </ScoutSecondaryBtn>
          {bookedCoach.nylasBookingRef && new Date(bookedCoach.startAt) >= new Date() && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", width: isMobile ? "100%" : undefined }}>
              <button
                type="button"
                onClick={() => router.push(`/coaching/reschedule/${encodeURIComponent(bookedCoach.nylasBookingRef!)}`)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  color: color.forest,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={() => router.push(`/coaching/cancel/${encodeURIComponent(bookedCoach.nylasBookingRef!)}`)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.muted,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recommendation nudge */}
      <div
        style={{
          ...CARD,
          padding: isMobile ? "18px 18px" : "20px 22px",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 16 : 20,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
              ⚡
            </span>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: 0, lineHeight: 1.35 }}>
              Not sure? Get personalized recommendations.
            </p>
          </div>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.55, margin: 0, paddingLeft: 30 }}>
            Finding the right coach or next step can be overwhelming. Talk to our team or jump straight to matches.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <ScoutSecondaryBtn
            onClick={handleScheduleCall}
            data-offer="discovery"
            data-trigger="dashboard_schedule"
            style={{ minHeight: 42, whiteSpace: "nowrap" }}
          >
            Schedule a call
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn onClick={handleRecommendation} style={{ minHeight: 42, whiteSpace: "nowrap" }}>
            {recommendationLabel}
          </ScoutPrimaryBtn>
        </div>
      </div>

      {/* Free events carousel */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: 0 }}>
            Free events
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => router.push("/live")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.forest,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Browse more
            </button>
            {!isMobile && eventSessions.length > 2 && (
              <>
                <button
                  type="button"
                  onClick={() => scrollEvents(-1)}
                  aria-label="Previous events"
                  style={{
                    width: 28,
                    height: 28,
                    border: border.line,
                    background: surface.card,
                    cursor: "pointer",
                    fontFamily: fontSans,
                  }}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => scrollEvents(1)}
                  aria-label="Next events"
                  style={{
                    width: 28,
                    height: 28,
                    border: border.line,
                    background: surface.card,
                    cursor: "pointer",
                    fontFamily: fontSans,
                  }}
                >
                  →
                </button>
              </>
            )}
          </div>
        </div>

        {!sessionsLoaded ? null : eventSessions.length === 0 ? (
          <div style={{ ...CARD, padding: "24px 20px", textAlign: "center" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.6, margin: "0 0 14px" }}>
              No sessions scheduled yet. Tell us what topics you&apos;d like to see.
            </p>
            <ScoutPrimaryBtn onClick={() => setInterestOpen(true)} style={{ minHeight: 42 }}>
              Register interest
            </ScoutPrimaryBtn>
          </div>
        ) : (
          <div
            ref={eventsScrollRef}
            style={{
              display: "flex",
              gap: 14,
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
              scrollSnapType: "x mandatory",
              paddingBottom: 4,
              margin: "0 -4px",
              padding: "0 4px 4px",
            }}
          >
            {eventSessions.map((session) => {
              const routeId = liveSessionRouteId(session);
              const isBusy = registerBusyId === session.id;
              return (
              <div
                key={session.id}
                style={{
                  ...CARD,
                  flex: "0 0 auto",
                  width: isMobile ? "min(280px, 85vw)" : 280,
                  scrollSnapAlign: "start",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    textAlign: "left",
                    padding: 0,
                    background: session.bgColor,
                    color: session.accentColor,
                    minHeight: 120,
                    width: "100%",
                  }}
                >
                  <div style={{ padding: "14px 16px" }}>
                    {session.isLive && (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          background: session.accentColor,
                          color: session.bgColor,
                          fontFamily: fontSans,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Live
                      </span>
                    )}
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 17,
                        fontWeight: 500,
                        fontStyle: "italic",
                        color: "#fff",
                        margin: "0 0 8px",
                        lineHeight: 1.25,
                      }}
                    >
                      {session.title}
                    </p>
                    <p style={{ fontFamily: fontSans, fontSize: T.label, opacity: 0.85, margin: 0 }}>
                      {session.date} · {session.time.split("–")[0]?.trim()}
                    </p>
                    <p style={{ fontFamily: fontSans, fontSize: T.label, opacity: 0.7, margin: "4px 0 0" }}>
                      {session.registered} registered
                    </p>
                  </div>
                </div>
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: session.bgColor,
                        color: session.accentColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: fontSans,
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {session.hostInitials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {session.host}
                      </p>
                      {session.hostRating != null && (
                        <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "2px 0 0" }}>
                          ★ {session.hostRating.toFixed(1)} ({session.hostReviews})
                        </p>
                      )}
                    </div>
                  </div>
                  <ScoutPrimaryBtn
                    onClick={() => {
                      if (session.isLive) {
                        router.push(`/live/${routeId}`);
                        return;
                      }
                      if (session.isRegistered) {
                        router.push(`/live/${routeId}`);
                        return;
                      }
                      void registerForSession(session);
                    }}
                    disabled={isBusy}
                    style={{ minHeight: 38, width: "100%", fontSize: T.caption }}
                  >
                    {session.isLive
                      ? "Join now →"
                      : isBusy
                        ? "Saving…"
                        : session.isRegistered
                          ? "Registered ✓"
                          : "Register →"}
                  </ScoutPrimaryBtn>
                </div>
              </div>
            );
            })}
          </div>
        )}

        {sessionsLoaded && eventSessions.length > 0 && (
          <button
            type="button"
            onClick={() => setInterestOpen(true)}
            style={{
              marginTop: 10,
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Suggest a topic →
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(280px, 340px) minmax(0, 1fr)",
          gap: isMobile ? 20 : 28,
          marginBottom: isMobile ? 32 : 40,
          alignItems: "start",
        }}
      >
        {isMobile ? (
          <>
            {leftColumn}
            {rightColumn}
          </>
        ) : (
          <>
            {leftColumn}
            {rightColumn}
          </>
        )}
      </div>

      {pendingSync && (
        <ProfileSyncPromptModal
          sync={pendingSync}
          onConfirm={confirmProfileSync}
          onSkip={() => setPendingSync(null)}
          saving={syncSaving}
        />
      )}
      {scheduleOpen && <GrowthDiscoveryModal trigger="dashboard_schedule" onClose={() => setScheduleOpen(false)} />}
      {interestOpen && <EventInterestModal onClose={() => setInterestOpen(false)} />}
    </>
  );
}
