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
import { MyCoachesPanel } from "@/components/scout/my-coaches-panel";
import { ExpertDashboardOverview } from "@/components/scout/expert-dashboard-overview";
import { EventInterestModal } from "@/components/scout/event-interest-modal";
import { GrowthDiscoveryModal } from "@/components/scout/growth-discovery-modal";
import { DashboardAddGoalModal } from "@/components/scout/dashboard-add-goal-modal";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
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

type AssignedCoach = {
  coachProfileId: string;
  displayName: string;
  slug: string | null;
  photoUrl: string | null;
  headline: string | null;
  isInternal: boolean;
  hasNylasBooking: boolean;
};

export function DashboardHomeTop({ isMobile }: Props) {
  const router = useRouter();
  const { openPricing, userRole, isImpersonating, showSeekerDashboard, showExpertDashboard, withClientScope, withClientReviewPath } =
    useWorkspace();
  const isStaffPortal = isStaffPortalRole(userRole);
  const showClientCoachUi = showSeekerDashboard;
  const { isPro, loading: subLoading } = useSubscription();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [pickValue, setPickValue] = useState("");
  const [pickTargetMonth, setPickTargetMonth] = useState("");
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editTargetMonth, setEditTargetMonth] = useState("");
  const [bookedCoach, setBookedCoach] = useState<BookedCoach | null>(null);
  const [assignedCoaches, setAssignedCoaches] = useState<AssignedCoach[]>([]);
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
    fetch(withClientScope("/api/profile"))
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
  }, [withClientScope]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    fetch(withClientScope("/api/live/sessions"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.sessions)) setAllSessions(d.sessions);
      })
      .catch(() => {})
      .finally(() => setSessionsLoaded(true));
  }, [withClientScope]);

  useEffect(() => {
    if (!showClientCoachUi) {
      setBookedCoach(null);
      setAssignedCoaches([]);
      setBookingLoading(false);
      return;
    }

    setBookingLoading(true);
    const assignedPromise = fetch(withClientScope("/api/coaching/assigned-coaches"))
      .then((r) => (r.ok ? r.json() : { coaches: [] }))
      .then((d) => setAssignedCoaches(d.coaches ?? []))
      .catch(() => setAssignedCoaches([]));

    const bookingPromise = fetch(withClientScope("/api/bookings/me?upcoming=true&limit=1"))
      .then((r) => (r.ok ? r.json() : null))
      .then(async (d) => {
        let row = d?.bookings?.[0];
        if (!row) {
          const pastRes = await fetch(withClientScope("/api/bookings/me?upcoming=false&limit=1"));
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
      .catch(() => setBookedCoach(null));

    Promise.all([assignedPromise, bookingPromise])
      .finally(() => setBookingLoading(false));
  }, [showClientCoachUi, withClientScope]);

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
    return fetch(withClientScope("/api/live/sessions"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.sessions)) setAllSessions(d.sessions);
      })
      .catch(() => {});
  }, [withClientScope]);

  const registerForSession = async (session: LiveSessionView) => {
    const routeId = liveSessionRouteId(session);
    setRegisterBusyId(session.id);
    try {
      const res = await fetch(withClientScope("/api/live/register"), {
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
      const res = await fetch(withClientScope("/api/profile"), {
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
    setGoalModalOpen(false);

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

  const openGoalModal = () => {
    setPickValue("");
    setPickTargetMonth("");
    setGoalModalOpen(true);
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
      const res = await fetch(withClientScope("/api/profile"), {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: isMobile ? undefined : "100%" }}>
      {/* Profile card — mint header band like Profile sidebar */}
      <ScoutBox padding={0} style={{ overflow: "hidden", position: "relative" }}>
        <button
          type="button"
          onClick={() => router.push(withClientReviewPath("/profile"))}
          aria-label="Edit profile"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 2,
            width: 32,
            height: 32,
            border: border.line,
            borderRadius: "var(--scout-radius)",
            background: surface.card,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color.muted,
            boxShadow: "var(--scout-shadow-card)",
          }}
        >
          ✎
        </button>
        <div style={{ height: isMobile ? 44 : 52, background: "rgba(74,139,106,0.18)" }} />
        <div
          style={{
            padding: isMobile ? "0 18px 20px" : "0 22px 24px",
            marginTop: isMobile ? -36 : -44,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              style={{
                width: isMobile ? 80 : 96,
                height: isMobile ? 80 : 96,
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: 14,
                border: "3px solid white",
                boxShadow: "var(--scout-shadow-card)",
              }}
            />
          ) : (
            <div
              style={{
                width: isMobile ? 80 : 96,
                height: isMobile ? 80 : 96,
                borderRadius: "50%",
                background: "rgba(74,139,106,0.15)",
                border: "3px solid white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
                fontFamily: fontSans,
                fontSize: 28,
                fontWeight: 600,
                color: color.forest,
                boxShadow: "var(--scout-shadow-card)",
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
              onClick={() => router.push(withClientReviewPath("/profile"))}
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
      </ScoutBox>

      {/* Kimchi Pro promo */}
      {showProPromo && (
        <ScoutBox
          padding="18px 20px"
          style={{
            background: "linear-gradient(135deg, rgba(45,31,82,0.06) 0%, rgba(26,58,47,0.08) 100%)",
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
        </ScoutBox>
      )}

      {/* Goals card — stretches to align with free events on desktop */}
      <ScoutBox
        padding={isMobile ? "16px 18px" : "18px 20px"}
        style={isMobile ? undefined : { flex: 1, display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: 0 }}>
            Your goals
          </p>
          {canAdd && (
            <button
              type="button"
              onClick={openGoalModal}
              aria-label="Add goal"
              style={{
                width: 28,
                height: 28,
                border: border.line,
                borderRadius: "var(--scout-radius)",
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
        ) : goals.length === 0 ? (
          <div>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.55, margin: "0 0 14px" }}>
              What are you working toward? Add up to {DASHBOARD_GOAL_MAX} outcomes.
            </p>
            {canAdd && (
              <ScoutPrimaryBtn onClick={openGoalModal} style={{ width: "100%", minHeight: 42 }}>
                Add your outcome
              </ScoutPrimaryBtn>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: canAdd ? 14 : 0 }}>
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

        {canAdd && goals.length > 0 && (
          <ScoutPrimaryBtn
            onClick={openGoalModal}
            style={{ width: "100%", minHeight: 42, marginTop: isMobile ? undefined : "auto" }}
          >
            Add your outcome
          </ScoutPrimaryBtn>
        )}
      </ScoutBox>
    </div>
  );

  const linkBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    padding: 0,
    fontFamily: fontSans,
    fontSize: T.caption,
    color: color.forest,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  };

  const rightColumn = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minWidth: 0,
        height: isMobile ? undefined : "100%",
      }}
    >
      {/* Coach status — seekers only */}
      {showClientCoachUi && !bookingLoading && !bookedCoach && assignedCoaches.length === 0 && (
        <ScoutBox
          padding={isMobile ? "16px 18px" : "18px 22px"}
          style={{
            borderStyle: "dashed",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: 0, flex: 1 }}>
            You don&apos;t have a coach yet. When your team assigns one, they&apos;ll show up here and under Coaching → My coaches.
          </p>
          <ScoutSecondaryBtn onClick={() => router.push("/coaching/my-coaches")} style={{ minHeight: 40, flexShrink: 0 }}>
            My coaches
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      {showClientCoachUi && !bookingLoading && !bookedCoach && assignedCoaches.length > 0 && (
        <ScoutBox padding={isMobile ? "16px 18px" : "18px 22px"} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Your Kimchi {assignedCoaches.length === 1 ? "coach" : "coaches"}
            </p>
            <button
              type="button"
              onClick={() => router.push("/coaching/my-coaches")}
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
              View in profile →
            </button>
          </div>
          {assignedCoaches.map((coach) => (
            <div
              key={coach.coachProfileId}
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                gap: 14,
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>
                    {coach.displayName}
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                    {coach.headline?.slice(0, 100) ?? "Book your intro call to get started."}
                  </p>
                </div>
              </div>
              <ScoutPrimaryBtn
                onClick={() => openCoachProfile(coach.slug, coach.coachProfileId)}
                style={{ minHeight: 40, flexShrink: 0, width: isMobile ? "100%" : undefined }}
              >
                {coach.hasNylasBooking ? "Book →" : "View →"}
              </ScoutPrimaryBtn>
            </div>
          ))}
        </ScoutBox>
      )}

      {showClientCoachUi && !bookingLoading && bookedCoach && (
        <ScoutBox
          padding={isMobile ? "16px 18px" : "18px 22px"}
          style={{
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
        </ScoutBox>
      )}

      {!showClientCoachUi && showExpertDashboard && (
        <ExpertDashboardOverview isMobile={isMobile} />
      )}

      {/* Recommendation nudge */}
      <ScoutBox
        padding={isMobile ? "18px 18px" : "20px 22px"}
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 16 : 20,
          background: "rgba(74,139,106,0.04)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
              ⚡
            </span>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: 0, lineHeight: 1.35 }}>
              Not sure where to start? Try recommended roles on Opportunities.
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
      </ScoutBox>

      {/* Free events — pinned to bottom on desktop to align with goals card */}
      <div style={{ minWidth: 0, marginTop: isMobile ? 0 : "auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: 0 }}>
            Free events
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, flexWrap: "wrap" }}>
            <button type="button" onClick={() => router.push("/live")} style={linkBtnStyle}>
              Browse more
            </button>
            {sessionsLoaded && eventSessions.length > 0 && (
              <button type="button" onClick={() => setInterestOpen(true)} style={{ ...linkBtnStyle, color: color.muted }}>
                Suggest a topic →
              </button>
            )}
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
                    borderRadius: "var(--scout-radius)",
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
                    borderRadius: "var(--scout-radius)",
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
          <ScoutBox padding="24px 20px" style={{ textAlign: "center" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.6, margin: "0 0 14px" }}>
              No sessions scheduled yet. Tell us what topics you&apos;d like to see.
            </p>
            <ScoutPrimaryBtn onClick={() => setInterestOpen(true)} style={{ minHeight: 42 }}>
              Register interest
            </ScoutPrimaryBtn>
          </ScoutBox>
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
              <ScoutBox
                key={session.id}
                padding={0}
                style={{
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
              </ScoutBox>
            );
            })}
          </div>
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
          alignItems: "stretch",
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
      <DashboardAddGoalModal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        pickValue={pickValue}
        onPickValueChange={setPickValue}
        pickTargetMonth={pickTargetMonth}
        onPickTargetMonthChange={setPickTargetMonth}
        availableOptions={availableOptions}
        saving={saving}
        onSave={() => void addGoal()}
      />
    </>
  );
}
