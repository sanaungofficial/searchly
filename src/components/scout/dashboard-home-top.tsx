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
import { isStaffPortalRole } from "@/lib/staff-portal";
import type { LiveSessionView } from "@/lib/live-session-types";
import { liveSessionRouteId } from "@/lib/live-sessions";
import { AssignedCoachSummaryBox } from "@/components/scout/assigned-coach-summary-box";
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
  recommendationTuningItems,
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


export function DashboardHomeTop({ isMobile }: Props) {
  const router = useRouter();
  const { userRole, isImpersonating, showSeekerDashboard, showExpertDashboard, withClientScope, withClientReviewPath, openPricing } =
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
  const actionItems = tuningInput ? recommendationTuningItems(tuningInput) : [];
  const pct = tuningInput ? recommendationTuningPct(tuningInput) : 0;
  const barColor = pct >= 75 ? color.forest : pct >= 50 ? "#C4A86A" : "#C4574A";

  const actionItemsAccordion = showClientCoachUi && (
    <ScoutBox
      padding={isMobile ? "16px 18px" : "18px 20px"}
      style={{ height: isMobile ? undefined : "100%", display: "flex", flexDirection: "column" }}
    >
      <button
        type="button"
        onClick={() => setActionItemsOpen((v) => !v)}
        aria-expanded={actionItemsOpen}
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
          flexShrink: 0,
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

      <div style={{ flex: isMobile ? undefined : 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            overflow: "hidden",
            maxHeight: actionItemsOpen ? 2000 : 0,
            opacity: actionItemsOpen ? 1 : 0,
            transition: "max-height 0.35s ease, opacity 0.25s ease",
            marginTop: actionItemsOpen ? 12 : 0,
          }}
        >
          <div style={{ height: 5, borderRadius: "var(--scout-radius)", background: surface.inset, border: "var(--scout-border)", overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: barColor, transition: "width 0.4s ease" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {actionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => !item.complete && handleFixGap(item.id)}
                disabled={item.complete}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "10px 4px",
                  border: "none",
                  borderRadius: "var(--scout-radius)",
                  background: "transparent",
                  cursor: item.complete ? "default" : "pointer",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: item.complete ? color.muted : color.ink,
                  textAlign: "left",
                  textDecoration: item.complete ? "line-through" : "none",
                  opacity: item.complete ? 0.65 : 1,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: item.complete ? "none" : "2px solid rgba(17,17,17,0.2)",
                    background: item.complete ? color.forest : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "#E8D5A3",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {item.complete && "✓"}
                </span>
                <span style={{ flex: 1 }}>{item.actionLabel}</span>
                {!item.complete && (
                  <span style={{ color: color.forest, fontWeight: 600, flexShrink: 0 }}>→</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ScoutBox>
  );

  const ctaCardStyle: React.CSSProperties = {
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 14,
    height: "100%",
    minHeight: isMobile ? undefined : 72,
  };

  // ── Quick action cards (Contra-style 2+1 grid) ─────────────────────────────
  const ctaCards = showClientCoachUi && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gridTemplateRows: isMobile ? undefined : "1fr auto",
        gap: 10,
        height: isMobile ? undefined : "100%",
        minHeight: 0,
      }}
    >
      <ScoutBox
        padding="14px 16px"
        style={ctaCardStyle}
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

      <ScoutBox
        padding="14px 16px"
        style={ctaCardStyle}
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

      <ScoutBox
        padding="14px 16px"
        style={{ ...ctaCardStyle, gridColumn: isMobile ? undefined : "1 / -1" }}
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
      onSubscribe={openPricing}
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
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading…</p>
      ) : goals.length === 0 ? (
        <div>
          <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, lineHeight: 1.55, margin: "0 0 14px" }}>
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
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 4px" }}>{targetLabel}</p>
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
                      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.host}</p>
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
    <div style={{ marginBottom: isMobile ? 20 : 24 }}>
      <p style={{ ...bruddleHeadingStyle(isMobile ? "h4" : "h3"), margin: 0 }}>
        Welcome, {profile.name.split(" ")[0]} 👋
      </p>
      {profile.headline && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "4px 0 0", lineHeight: 1.4 }}>
          {profile.headline.slice(0, 80)}
        </p>
      )}
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
            alignItems: isMobile ? "start" : "stretch",
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
          <AssignedCoachSummaryBox isMobile={isMobile} enabled={showClientCoachUi} />
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
