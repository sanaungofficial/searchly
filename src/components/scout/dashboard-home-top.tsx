"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
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
import { ExpertDashboardOverview } from "@/components/scout/expert-dashboard-overview";
import { EventInterestModal } from "@/components/scout/event-interest-modal";
import { GrowthDiscoveryModal } from "@/components/scout/growth-discovery-modal";
import { ProfileSyncPromptModal } from "@/components/scout/profile-sync-prompt-modal";
import { DashboardGoalWizardModal } from "@/components/scout/dashboard-goal-wizard-modal";
import { MatchingPrefPromptModal, type MatchingPrefProfile } from "@/components/scout/matching-pref-prompt-modal";
import { SectionHeadingWithHelp, SectionHelpTip } from "@/components/scout/section-help-tip";
import { DashboardGetStarted } from "@/components/scout/dashboard-get-started";
import { DiscoveryScoreCard } from "@/components/scout/discovery-score-card";
import {
  recommendationTuningGaps,
  recommendationTuningPct,
  isGoalsWizardDismissed,
  type MatchingTuningGapId,
  type RecommendationTuningInput,
} from "@/lib/recommendation-tuning";
import type { RelocationId, VisaNeedId, WorkArrangementId } from "@/lib/onboarding-preferences";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn, scoutFieldStyle, scoutInsetChipStyle } from "@/components/scout/scout-box";
import { bruddleHeadingStyle, color, fontSans, fontDisplay, surface, type as T } from "@/lib/typography";

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
  targetRoles: string[];
  prioritizedRoles: string[];
  targetMarket: string | null;
  priorities: string[];
  relocationOpenness: string | null;
  workAuthorization: string | null;
  targetSalary: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  parsedData: { location?: string | null; workExperience?: unknown[]; phone?: string | null; education?: unknown[]; skills?: unknown[]; tools?: unknown[] } | null;
  email: string | null;
  hasStrategy: boolean;
};

function inferWorkArrangement(priorities: string[]): WorkArrangementId {
  const lower = priorities.map((p) => p.toLowerCase());
  if (lower.some((p) => p.includes("remote-first"))) return "remote_only";
  if (lower.some((p) => p.includes("hybrid"))) return "hybrid_ok";
  return "";
}

function inferRelocationId(openness: string | null): RelocationId {
  const lower = (openness ?? "").toLowerCase();
  if (lower.includes("internationally")) return "international";
  if (lower.includes("within")) return "domestic";
  if (lower.includes("stay") || lower.includes("local")) return "local";
  return "";
}

function inferVisaNeed(auth: string | null): VisaNeedId {
  const lower = (auth ?? "").toLowerCase();
  if (lower.includes("need") || lower.includes("sponsorship")) return "sponsored";
  if (lower.includes("authorized")) return "authorized";
  return "";
}

function matchingPrefFromProfile(p: ProfileData): MatchingPrefProfile {
  const priorities = p.priorities ?? [];
  return {
    targetRoles: p.targetRoles ?? [],
    prioritizedRoles: p.prioritizedRoles ?? [],
    targetMarket: p.targetMarket ?? "",
    fullyRemote: priorities.some((x) => x.toLowerCase().includes("remote-first")) && !p.targetMarket?.trim(),
    workArrangement: inferWorkArrangement(priorities),
    relocation: inferRelocationId(p.relocationOpenness),
    visaNeed: inferVisaNeed(p.workAuthorization),
    targetSalary: p.targetSalary ?? "",
    jobTimeline: p.jobTimeline ?? "",
    priorities,
  };
}

function tuningInputFromProfile(p: ProfileData): RecommendationTuningInput {
  return {
    targetRoles: p.targetRoles,
    prioritizedRoles: p.prioritizedRoles,
    targetMarket: p.targetMarket,
    parsedData: p.parsedData,
    priorities: p.priorities,
    relocationOpenness: p.relocationOpenness,
    workAuthorization: p.workAuthorization,
    targetSalary: p.targetSalary,
    jobTimeline: p.jobTimeline,
    dashboardGoals: p.dashboardGoals,
    resumeUrl: p.resumeUrl,
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
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
  const { userRole, isImpersonating, showSeekerDashboard, showExpertDashboard, withClientScope, withClientReviewPath } =
    useWorkspace();
  const isStaffPortal = isStaffPortalRole(userRole);
  const showClientCoachUi = showSeekerDashboard;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalWizardIntro, setGoalWizardIntro] = useState(false);
  const [activeGapId, setActiveGapId] = useState<MatchingTuningGapId | null>(null);
  const goalWizardAutoOpenedRef = useRef(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editTargetMonth, setEditTargetMonth] = useState("");
  const [bookedCoach, setBookedCoach] = useState<BookedCoach | null>(null);
  const [assignedCoaches, setAssignedCoaches] = useState<AssignedCoach[]>([]);
  const [bookingLoading, setBookingLoading] = useState(true);
  const [pendingSync, setPendingSync] = useState<ReturnType<typeof profileNeedsSyncForGoal>>(null);
  const [syncSaving, setSyncSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [interestOpen, setInterestOpen] = useState(false);
  const [actionItemsOpen, setActionItemsOpen] = useState(true);

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
          targetRoles: data.targetRoles ?? [],
          prioritizedRoles: data.prioritizedRoles ?? [],
          targetMarket: data.targetMarket ?? null,
          priorities: data.priorities ?? [],
          relocationOpenness: data.relocationOpenness ?? null,
          workAuthorization: data.workAuthorization ?? null,
          targetSalary: data.targetSalary ?? null,
          resumeUrl: data.resumeUrl ?? null,
          linkedinUrl: data.linkedinUrl ?? null,
          parsedData: data.parsedData ?? null,
          email: data.email ?? null,
          hasStrategy: data.hasStrategy ?? false,
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
        if (!row) { setBookedCoach(null); return; }
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

    Promise.all([assignedPromise, bookingPromise]).finally(() => setBookingLoading(false));
  }, [showClientCoachUi, withClientScope]);

  useEffect(() => {
    if (!showClientCoachUi || loading || !profile || goalWizardAutoOpenedRef.current) return;
    if (profile.dashboardGoals.length > 0 || isGoalsWizardDismissed()) return;
    goalWizardAutoOpenedRef.current = true;
    setGoalWizardIntro(true);
    setGoalModalOpen(true);
  }, [showClientCoachUi, loading, profile]);

  const tuningInput = useMemo(() => (profile ? tuningInputFromProfile(profile) : null), [profile]);
  const matchingPrefProfile = useMemo(
    () => (profile ? matchingPrefFromProfile(profile) : matchingPrefFromProfile({
      name: "", avatarUrl: null, headline: null, summary: null, jobTimeline: null,
      careerMotivation: null, employmentStatus: null, dashboardGoals: [], targetRoles: [],
      prioritizedRoles: [], targetMarket: null, priorities: [], relocationOpenness: null,
      workAuthorization: null, targetSalary: null, resumeUrl: null, linkedinUrl: null,
      parsedData: null, email: null, hasStrategy: false,
    })),
    [profile],
  );
  const goals = profile?.dashboardGoals ?? [];
  const usedValues = useMemo(() => new Set(goals.map((g) => g.value)), [goals]);
  const availableOptions = DASHBOARD_GOAL_OPTIONS.filter((o) => !usedValues.has(o.value));
  const canAdd = goals.length < DASHBOARD_GOAL_MAX && availableOptions.length > 0;

  const eventSessions = useMemo(() => {
    const live = allSessions.filter((s) => s.isLive);
    const upcoming = allSessions.filter((s) => !s.isLive && s.status !== "ENDED" && s.status !== "CANCELLED");
    return [...live, ...upcoming].slice(0, 8);
  }, [allSessions]);

  const reloadSessions = useCallback(() => {
    return fetch(withClientScope("/api/live/sessions"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.sessions)) setAllSessions(d.sessions); })
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
      // non-blocking
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
      if (res.ok) setProfile((p) => (p ? { ...p, dashboardGoals: next } : p));
    } finally {
      setSaving(false);
    }
  };

  const saveGoalFromWizard = async (partial: Omit<DashboardGoal, "id" | "createdAt">) => {
    const option = findDashboardGoalOption(partial.value);
    if (!option || !profile || usedValues.has(option.value) || goals.length >= DASHBOARD_GOAL_MAX) return;
    const next: DashboardGoal = {
      id: crypto.randomUUID(), category: partial.category, value: partial.value,
      label: partial.label, createdAt: new Date().toISOString(),
      ...(partial.targetDate ? { targetDate: partial.targetDate } : {}),
    };
    await persistGoals([...goals, next]);
    setGoalModalOpen(false);
    setGoalWizardIntro(false);
    const sync = profileNeedsSyncForGoal(option.value, profile);
    if (sync) setPendingSync(sync);
  };

  const closeGoalModal = () => { setGoalModalOpen(false); setGoalWizardIntro(false); };

  const saveMatchingPref = async (patch: Record<string, unknown>) => {
    const res = await fetch(withClientScope("/api/profile"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) loadProfile();
  };

  const handleFixGap = (gapId: MatchingTuningGapId) => {
    if (gapId === "primary_goal") { setGoalWizardIntro(false); setGoalModalOpen(true); return; }
    if (gapId === "target_roles" || gapId === "resume") { router.push(withClientReviewPath("/profile")); return; }
    setActiveGapId(gapId);
  };

  const removeGoal = (id: string) => persistGoals(goals.filter((g) => g.id !== id));

  const updateGoalTarget = async (id: string, targetDate: string | null) => {
    const next = goals.map((g) => g.id === id ? { ...g, targetDate: targetDate?.trim().slice(0, 7) || null } : g);
    await persistGoals(next);
    setEditingTargetId(null);
    setEditTargetMonth("");
  };

  const openGoalModal = () => { setGoalWizardIntro(false); setGoalModalOpen(true); };
  const openCoachProfile = (slug: string | null, coachId: string) => {
    if (slug) router.push(`/coach/${slug}`);
    else router.push("/coaching");
  };

  const handleScheduleCall = () => {
    if (SALES_TEAM_FORM_URL) { window.open(SALES_TEAM_FORM_URL, "_blank", "noopener,noreferrer"); return; }
    setScheduleOpen(true);
  };

  const handleRecommendation = () => {
    if (goals.length === 0) { router.push("/coaching"); return; }
    router.push(recommendationPathForGoals(goals));
  };

  const recommendationLabel = goals.length > 0 ? recommendationLabelForGoals(goals) : "Show me roles to explore";

  const confirmProfileSync = async () => {
    if (!pendingSync) return;
    setSyncSaving(true);
    try {
      const res = await fetch(withClientScope("/api/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [pendingSync.field]: pendingSync.suggestedValue }),
      });
      if (res.ok && profile) setProfile({ ...profile, [pendingSync.field]: pendingSync.suggestedValue });
    } finally {
      setSyncSaving(false);
      setPendingSync(null);
    }
  };

  const scrollEvents = (dir: -1 | 1) => eventsScrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  const linkBtnStyle: React.CSSProperties = {
    background: "none", border: "none", padding: 0, fontFamily: fontSans,
    fontSize: T.caption, color: color.forest, cursor: "pointer",
    textDecoration: "underline", textUnderlineOffset: 3,
  };

  // ── Action items (gaps) ───────────────────────────────────────────────────
  const gaps = tuningInput ? recommendationTuningGaps(tuningInput) : [];
  const pct = tuningInput ? recommendationTuningPct(tuningInput) : 0;
  const barColor = pct >= 75 ? color.forest : pct >= 50 ? "#C4A86A" : "#C4574A";

  const actionItemsAccordion = showClientCoachUi && pct < 100 && (
    <ScoutBox padding={isMobile ? "16px 18px" : "18px 20px"}>
      <button
        type="button"
        onClick={() => setActionItemsOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          gap: 12,
          marginBottom: actionItemsOpen ? 12 : 0,
        }}
      >
        <span style={{ ...bruddleHeadingStyle("h5") }}>
          Your action items
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: barColor }}>
            {pct}% done
          </span>
          <span style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>
            {actionItemsOpen ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {actionItemsOpen && (
        <>
          {/* Progress bar */}
          <div style={{ height: 5, borderRadius: 3, background: surface.inset, border: "var(--scout-border)", overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: barColor, transition: "width 0.4s ease" }} />
          </div>

          {/* Gap items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gaps.slice(0, 5).map((gap) => (
              <button
                key={gap.id}
                type="button"
                onClick={() => handleFixGap(gap.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  padding: "10px 12px",
                  border: "var(--scout-border)",
                  borderRadius: "var(--scout-radius)",
                  background: surface.inset,
                  cursor: "pointer",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.ink,
                  textAlign: "left",
                }}
              >
                <span>{gap.actionLabel}</span>
                <span style={{ color: color.forest, fontWeight: 600, flexShrink: 0 }}>Add →</span>
              </button>
            ))}
            {gaps.length > 5 && (
              <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: 0 }}>
                +{gaps.length - 5} more in Profile → Preferences
              </p>
            )}
          </div>
        </>
      )}
    </ScoutBox>
  );

  // ── Three CTA cards ───────────────────────────────────────────────────────
  const ctaCards = showClientCoachUi && (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Update profile */}
      <ScoutBox
        padding="14px 16px"
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
        onClick={() => router.push(withClientReviewPath("/profile"))}
      >
        <div style={{ width: 36, height: 36, borderRadius: "var(--scout-radius)", background: "rgba(26,58,47,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          👤
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 2px" }}>Update your profile</p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.4 }}>Improve your Discovery Score</p>
        </div>
        <span style={{ color: color.muted, fontSize: 14, flexShrink: 0 }}>→</span>
      </ScoutBox>

      {/* Discover opportunities */}
      <ScoutBox
        padding="14px 16px"
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
        onClick={handleRecommendation}
      >
        <div style={{ width: 36, height: 36, borderRadius: "var(--scout-radius)", background: "rgba(196,168,106,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          🔍
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 2px" }}>Discover opportunities</p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.4 }}>Browse roles matched to you</p>
        </div>
        <span style={{ color: color.muted, fontSize: 14, flexShrink: 0 }}>→</span>
      </ScoutBox>

      {/* Schedule a call */}
      <ScoutBox
        padding="14px 16px"
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
        onClick={handleScheduleCall}
      >
        <div style={{ width: 36, height: 36, borderRadius: "var(--scout-radius)", background: "rgba(74,139,106,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          📞
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 2px" }}>Schedule a call</p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.4 }}>Talk to our placement team</p>
        </div>
        <span style={{ color: color.muted, fontSize: 14, flexShrink: 0 }}>→</span>
      </ScoutBox>
    </div>
  );

  // ── Discovery Score ───────────────────────────────────────────────────────
  const discoveryScoreCard = showClientCoachUi && profile && !loading && tuningInput && (
    <DiscoveryScoreCard
      input={{
        name: profile.name,
        headline: profile.headline,
        targetRoles: profile.targetRoles,
        resumeUrl: profile.resumeUrl,
        linkedinUrl: profile.linkedinUrl,
        experience: (profile.parsedData?.workExperience as unknown[] | null) ?? null,
        skills: (profile.parsedData?.skills as string[] | null) ?? null,
        targetSalary: profile.targetSalary,
        location: profile.parsedData?.location ?? profile.targetMarket ?? null,
        employmentStatus: profile.employmentStatus,
        summary: profile.summary,
      }}
      avatarUrl={profile.avatarUrl}
      isMobile={isMobile}
      withClientScope={withClientScope}
    />
  );

  // ── Goals card ────────────────────────────────────────────────────────────
  const goalsCard = (
    <ScoutBox padding={isMobile ? "16px 18px" : "18px 20px"}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
        <SectionHeadingWithHelp
          title="Your goals"
          help="What you're working toward right now — landing a role, prepping for interviews, leveling up, and so on."
          trailing={
            canAdd ? (
              <button
                type="button"
                onClick={openGoalModal}
                aria-label="Add goal"
                style={{
                  width: 28, height: 28, border: "var(--scout-border)", borderRadius: "var(--scout-radius)",
                  background: surface.inset, cursor: "pointer", fontFamily: fontSans,
                  fontSize: 18, lineHeight: 1, color: color.forest,
                }}
              >
                +
              </button>
            ) : undefined
          }
        />
      </div>

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>Loading…</p>
      ) : goals.length === 0 ? (
        <div>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.55, margin: "0 0 14px" }}>
            What are you trying to achieve? You can add up to {DASHBOARD_GOAL_MAX} goals.
          </p>
          {canAdd && (
            <ScoutPrimaryBtn onClick={openGoalModal} style={{ width: "100%", minHeight: 42 }}>
              Add a goal
            </ScoutPrimaryBtn>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: canAdd ? 14 : 0 }}>
          {goals.map((goal) => {
            const targetLabel = formatGoalTargetDate(goal.targetDate);
            const isEditingTarget = editingTargetId === goal.id;
            return (
              <div key={goal.id} style={{ borderBottom: "var(--scout-border)", paddingBottom: 12 }}>
                {targetLabel && (
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>{targetLabel}</p>
                )}
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 8px", lineHeight: 1.4 }}>
                  {goal.label}
                </p>
                {isEditingTarget && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <input
                      type="month"
                      value={editTargetMonth}
                      onChange={(e) => setEditTargetMonth(e.target.value)}
                      style={{ ...scoutFieldStyle, flex: 1, minWidth: 140, padding: "8px 10px", fontSize: isMobile ? 16 : T.bodySm }}
                    />
                    <ScoutSecondaryBtn onClick={() => updateGoalTarget(goal.id, editTargetMonth || null)} disabled={saving} style={{ minHeight: 36 }}>
                      Save
                    </ScoutSecondaryBtn>
                    <button type="button" onClick={() => { setEditingTargetId(null); setEditTargetMonth(""); }}
                      style={{ background: "none", border: "none", fontFamily: fontSans, fontSize: T.caption, color: color.muted, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={scoutInsetChipStyle}>{dashboardGoalCategoryLabel(goal.category)}</span>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button type="button" onClick={() => { setEditingTargetId(goal.id); setEditTargetMonth(goal.targetDate ?? ""); }} disabled={saving}
                      style={{ background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: T.caption, color: color.forest, cursor: saving ? "default" : "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => removeGoal(goal.id)} disabled={saving}
                      style={{ background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: T.caption, color: color.muted, cursor: saving ? "default" : "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
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
        <ScoutPrimaryBtn onClick={openGoalModal} style={{ width: "100%", minHeight: 42, marginTop: 14 }}>
          Add another goal
        </ScoutPrimaryBtn>
      )}
    </ScoutBox>
  );

  // ── Coaches section ───────────────────────────────────────────────────────
  const coachSection = showClientCoachUi && !bookingLoading && (
    <>
      {!bookedCoach && assignedCoaches.length === 0 && (
        <ScoutBox padding={isMobile ? "16px 18px" : "18px 20px"} style={{ borderStyle: "dashed", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <p style={{ ...bruddleHeadingStyle("h5"), margin: 0 }}>My coaches</p>
            <SectionHelpTip text="Your Kimchi coach works with you one-on-one. When someone is assigned to you, they'll show up here." label="About My coaches" />
          </div>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: 0 }}>
            No coach assigned yet. When your team adds one, they'll appear here.
          </p>
          <ScoutSecondaryBtn onClick={() => router.push(withClientReviewPath("/coaching/my-coaches"))} style={{ minHeight: 40, width: "100%" }}>
            View coaches
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      {assignedCoaches.length > 0 && (
        <ScoutBox padding={isMobile ? "16px 18px" : "18px 20px"} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SectionHeadingWithHelp
            title="My coaches"
            help="Your Kimchi coach works with you one-on-one."
            trailing={
              <button type="button" onClick={() => router.push(withClientReviewPath("/coaching/my-coaches"))}
                style={{ background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                View all →
              </button>
            }
          />
          {assignedCoaches.map((coach) => (
            <div key={coach.coachProfileId} style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: assignedCoaches.length > 1 ? 12 : 0, borderBottom: assignedCoaches.length > 1 ? "var(--scout-border)" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>{coach.displayName}</p>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.45 }}>{coach.headline?.slice(0, 80) ?? "Book your intro call to get started."}</p>
                </div>
              </div>
              <ScoutPrimaryBtn onClick={() => openCoachProfile(coach.slug, coach.coachProfileId)} style={{ minHeight: 38, width: "100%" }}>
                {coach.hasNylasBooking ? "Book →" : "View →"}
              </ScoutPrimaryBtn>
            </div>
          ))}
        </ScoutBox>
      )}

      {bookedCoach && (
        <ScoutBox padding={isMobile ? "16px 18px" : "18px 20px"} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionHeadingWithHelp title="My coaches" help="Your Kimchi coach works with you one-on-one." />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CoachAvatar name={bookedCoach.coach.displayName} photoUrl={bookedCoach.coach.photoUrl} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>
                {new Date(bookedCoach.startAt) >= new Date() ? "Upcoming session" : "Recent session"}
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>{bookedCoach.coach.displayName}</p>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                {new Date(bookedCoach.startAt) >= new Date() ? formatBookingWhen(bookedCoach.startAt) : `Last · ${formatBookingWhen(bookedCoach.startAt)}`}
              </p>
            </div>
          </div>
          <ScoutSecondaryBtn onClick={() => openCoachProfile(bookedCoach.coach.slug, bookedCoach.coach.id)} style={{ minHeight: 38, width: "100%" }}>
            View coach →
          </ScoutSecondaryBtn>
          {bookedCoach.nylasBookingRef && new Date(bookedCoach.startAt) >= new Date() && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="button" onClick={() => router.push(`/coaching/reschedule/${encodeURIComponent(bookedCoach.nylasBookingRef!)}`)}
                style={{ background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                Reschedule
              </button>
              <button type="button" onClick={() => router.push(`/coaching/cancel/${encodeURIComponent(bookedCoach.nylasBookingRef!)}`)}
                style={{ background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: T.caption, color: color.muted, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                Cancel
              </button>
            </div>
          )}
        </ScoutBox>
      )}
    </>
  );

  // ── Events carousel ───────────────────────────────────────────────────────
  const eventsSection = (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <SectionHeadingWithHelp title="Free live trainings" help="Live group sessions with coaches and industry folks — always free." />
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, flexWrap: "wrap" }}>
          <button type="button" onClick={() => router.push("/live")} style={linkBtnStyle}>Browse more</button>
          {sessionsLoaded && eventSessions.length > 0 && (
            <button type="button" onClick={() => setInterestOpen(true)} style={{ ...linkBtnStyle, color: color.muted }}>Suggest a topic →</button>
          )}
          {!isMobile && eventSessions.length > 2 && (
            <>
              <button type="button" onClick={() => scrollEvents(-1)} aria-label="Previous" style={{ width: 28, height: 28, border: "var(--scout-border)", borderRadius: "var(--scout-radius)", background: surface.card, cursor: "pointer", fontFamily: fontSans }}>←</button>
              <button type="button" onClick={() => scrollEvents(1)} aria-label="Next" style={{ width: 28, height: 28, border: "var(--scout-border)", borderRadius: "var(--scout-radius)", background: surface.card, cursor: "pointer", fontFamily: fontSans }}>→</button>
            </>
          )}
        </div>
      </div>

      {!sessionsLoaded ? null : eventSessions.length === 0 ? (
        <ScoutBox padding="24px 20px" style={{ textAlign: "center" }}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.6, margin: "0 0 14px" }}>
            Nothing scheduled yet — tell us what topics you&apos;d like to see.
          </p>
          <ScoutPrimaryBtn onClick={() => setInterestOpen(true)} style={{ minHeight: 42 }}>Register interest</ScoutPrimaryBtn>
        </ScoutBox>
      ) : (
        <div
          ref={eventsScrollRef}
          style={{ display: "flex", gap: 14, overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory", margin: "0 -4px", padding: "0 4px 4px" }}
        >
          {eventSessions.map((session) => {
            const routeId = liveSessionRouteId(session);
            const isBusy = registerBusyId === session.id;
            return (
              <ScoutBox key={session.id} padding={0} style={{ flex: "0 0 auto", width: isMobile ? "min(280px, 85vw)" : 280, scrollSnapAlign: "start", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ textAlign: "left", padding: 0, background: session.bgColor, color: session.accentColor, minHeight: 120, width: "100%" }}>
                  <div style={{ padding: "14px 16px" }}>
                    {session.isLive && (
                      <span style={{ display: "inline-block", padding: "2px 8px", background: session.accentColor, color: session.bgColor, fontFamily: fontSans, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Live</span>
                    )}
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, fontStyle: "italic", color: "#fff", margin: "0 0 8px", lineHeight: 1.25 }}>{session.title}</p>
                    <p style={{ fontFamily: fontSans, fontSize: T.label, opacity: 0.85, margin: 0 }}>{session.date} · {session.time.split("–")[0]?.trim()}</p>
                    <p style={{ fontFamily: fontSans, fontSize: T.label, opacity: 0.7, margin: "4px 0 0" }}>{session.registered} registered</p>
                  </div>
                </div>
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: session.bgColor, color: session.accentColor, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontSans, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {session.hostInitials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.host}</p>
                      {session.hostRating != null && (
                        <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "2px 0 0" }}>★ {session.hostRating.toFixed(1)} ({session.hostReviews})</p>
                      )}
                    </div>
                  </div>
                  <ScoutPrimaryBtn
                    onClick={() => {
                      if (session.isLive || session.isRegistered) { router.push(`/live/${routeId}`); return; }
                      void registerForSession(session);
                    }}
                    disabled={isBusy}
                    style={{ minHeight: 38, width: "100%", fontSize: T.caption }}
                  >
                    {session.isLive ? "Join now →" : isBusy ? "Saving…" : session.isRegistered ? "Registered ✓" : "Register →"}
                  </ScoutPrimaryBtn>
                </div>
              </ScoutBox>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Welcome header ────────────────────────────────────────────────────────
  const welcomeHeader = showClientCoachUi && profile && (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: isMobile ? 20 : 24 }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: color.forest, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fontSans, fontSize: 16, fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : initials(profile.name)}
      </div>
      <div>
        <p style={{ ...bruddleHeadingStyle(isMobile ? "h4" : "h3"), margin: 0 }}>
          Welcome, {profile.name.split(" ")[0]}
        </p>
        {profile.headline && (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "4px 0 0", lineHeight: 1.4 }}>
            {profile.headline.slice(0, 80)}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Welcome header */}
      {welcomeHeader}

      {/* Two-column row: action items + CTA cards */}
      {showClientCoachUi && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.2fr) minmax(0, 1fr)",
            gap: isMobile ? 16 : 20,
            marginBottom: isMobile ? 20 : 24,
            alignItems: "start",
          }}
        >
          {actionItemsAccordion || <div />}
          {ctaCards}
        </div>
      )}

      {/* Discovery Score — full width */}
      {discoveryScoreCard && (
        <div style={{ marginBottom: isMobile ? 20 : 24 }}>
          {discoveryScoreCard}
        </div>
      )}

      {/* Goals (bigger, more prominent) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(280px, 340px) minmax(0, 1fr)",
          gap: isMobile ? 20 : 28,
          marginBottom: isMobile ? 24 : 28,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {goalsCard}
          {coachSection}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!showClientCoachUi && showExpertDashboard && <ExpertDashboardOverview isMobile={isMobile} />}
          {eventsSection}
        </div>
      </div>

      {/* Job search metrics */}
      {showClientCoachUi && <DashboardGetStarted isMobile={isMobile} />}

      {/* Modals */}
      {pendingSync && <ProfileSyncPromptModal sync={pendingSync} onConfirm={confirmProfileSync} onSkip={() => setPendingSync(null)} saving={syncSaving} />}
      {scheduleOpen && <GrowthDiscoveryModal trigger="dashboard_schedule" onClose={() => setScheduleOpen(false)} />}
      {interestOpen && <EventInterestModal onClose={() => setInterestOpen(false)} />}
      <DashboardGoalWizardModal open={goalModalOpen} showIntro={goalWizardIntro} onClose={closeGoalModal} onSave={saveGoalFromWizard} availableOptions={availableOptions} saving={saving} />
      <MatchingPrefPromptModal
        open={activeGapId !== null}
        gapId={activeGapId}
        profile={matchingPrefProfile}
        onClose={() => setActiveGapId(null)}
        onSave={saveMatchingPref}
        onOpenGoalWizard={() => { setActiveGapId(null); setGoalWizardIntro(false); setGoalModalOpen(true); }}
      />
    </>
  );
}
