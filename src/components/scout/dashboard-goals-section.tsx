"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DASHBOARD_GOAL_MAX,
  DASHBOARD_GOAL_OPTIONS,
  type DashboardGoal,
  dashboardGoalCategoryLabel,
  findDashboardGoalOption,
  hasCoachingGoal,
  profileNeedsSyncForGoal,
  recommendationLabelForGoals,
  recommendationPathForGoals,
  SALES_TEAM_FORM_URL,
} from "@/lib/dashboard-goals";
import { GrowthDiscoveryModal } from "@/components/scout/growth-discovery-modal";
import { ProfileSyncPromptModal } from "@/components/scout/profile-sync-prompt-modal";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type ProfileSnapshot = {
  careerMotivation: string | null;
  jobTimeline: string | null;
  employmentStatus: string | null;
};

type Props = {
  isMobile: boolean;
};

export function DashboardGoalsSection({ isMobile }: Props) {
  const router = useRouter();
  const [goals, setGoals] = useState<DashboardGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickValue, setPickValue] = useState("");
  const [profile, setProfile] = useState<ProfileSnapshot>({
    careerMotivation: null,
    jobTimeline: null,
    employmentStatus: null,
  });
  const [pendingSync, setPendingSync] = useState<ReturnType<typeof profileNeedsSyncForGoal>>(null);
  const [syncSaving, setSyncSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const loadProfile = useCallback(() => {
    setLoading(true);
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.error) return;
        setGoals(data.dashboardGoals ?? []);
        setProfile({
          careerMotivation: data.careerMotivation ?? null,
          jobTimeline: data.jobTimeline ?? null,
          employmentStatus: data.employmentStatus ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const usedValues = useMemo(() => new Set(goals.map((g) => g.value)), [goals]);
  const availableOptions = DASHBOARD_GOAL_OPTIONS.filter((o) => !usedValues.has(o.value));
  const canAdd = goals.length < DASHBOARD_GOAL_MAX && availableOptions.length > 0;

  const persistGoals = async (next: DashboardGoal[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardGoals: next }),
      });
      if (res.ok) setGoals(next);
    } finally {
      setSaving(false);
    }
  };

  const addGoal = async () => {
    const option = findDashboardGoalOption(pickValue);
    if (!option || usedValues.has(option.value) || goals.length >= DASHBOARD_GOAL_MAX) return;

    const next: DashboardGoal = {
      id: crypto.randomUUID(),
      category: option.category,
      value: option.value,
      label: option.label,
      createdAt: new Date().toISOString(),
    };
    const nextGoals = [...goals, next];
    await persistGoals(nextGoals);
    setPickValue("");

    const sync = profileNeedsSyncForGoal(option.value, profile);
    if (sync) setPendingSync(sync);
  };

  const removeGoal = (id: string) => {
    persistGoals(goals.filter((g) => g.id !== id));
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
      router.push("/opportunities/pipeline");
      return;
    }
    router.push(recommendationPathForGoals(goals));
  };

  const confirmProfileSync = async () => {
    if (!pendingSync) return;
    setSyncSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [pendingSync.field]: pendingSync.suggestedValue }),
      });
      if (res.ok) {
        setProfile((p) => ({ ...p, [pendingSync.field]: pendingSync.suggestedValue }));
      }
    } finally {
      setSyncSaving(false);
      setPendingSync(null);
    }
  };

  const recommendationLabel =
    goals.length > 0 ? recommendationLabelForGoals(goals) : "Browse opportunities";

  return (
    <>
      <div style={{ marginBottom: isMobile ? 28 : 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>Your goals</ScoutLabel>
        </div>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.6, margin: "0 0 16px", maxWidth: 560 }}>
          Pick up to {DASHBOARD_GOAL_MAX} focus areas — we&apos;ll tailor recommendations and nudges from here.
        </p>

        {loading ? (
          <ScoutBox padding="16px 18px">
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading goals…</p>
          </ScoutBox>
        ) : (
          <>
            {goals.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {goals.map((goal) => (
                  <ScoutBox
                    key={goal.id}
                    padding={isMobile ? "12px 14px" : "14px 16px"}
                    style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 4px", lineHeight: 1.35 }}>
                        {goal.label}
                      </p>
                      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {dashboardGoalCategoryLabel(goal.category)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGoal(goal.id)}
                      disabled={saving}
                      aria-label={`Remove ${goal.label}`}
                      style={{
                        background: "none",
                        border: border.line,
                        padding: "6px 10px",
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        color: color.muted,
                        cursor: saving ? "default" : "pointer",
                        flexShrink: 0,
                      }}
                    >
                      Remove
                    </button>
                  </ScoutBox>
                ))}
              </div>
            )}

            {canAdd && (
              <div
                style={{
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <select
                  value={pickValue}
                  onChange={(e) => setPickValue(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "12px 12px",
                    border: border.line,
                    borderRadius: 0,
                    background: surface.card,
                    fontFamily: fontSans,
                    fontSize: isMobile ? 16 : T.bodySm,
                    color: color.ink,
                    minWidth: 0,
                  }}
                >
                  <option value="">Add a goal…</option>
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
                <ScoutSecondaryBtn
                  onClick={addGoal}
                  disabled={!pickValue || saving}
                  style={{ minHeight: 44, width: isMobile ? "100%" : undefined, flexShrink: 0 }}
                >
                  {saving ? "Saving…" : "Add goal"}
                </ScoutSecondaryBtn>
              </div>
            )}

            {!canAdd && goals.length >= DASHBOARD_GOAL_MAX && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 16px" }}>
                Maximum {DASHBOARD_GOAL_MAX} goals — remove one to add another.
              </p>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 10,
              }}
            >
              <ScoutPrimaryBtn
                onClick={handleScheduleCall}
                data-offer="discovery"
                data-trigger="dashboard_schedule"
                style={{ minHeight: 44, width: "100%" }}
              >
                Schedule a call →
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn onClick={handleRecommendation} style={{ minHeight: 44, width: "100%" }}>
                {recommendationLabel} →
              </ScoutSecondaryBtn>
            </div>
          </>
        )}

        {!loading && hasCoachingGoal(goals) && (
          <ScoutBox
            padding={isMobile ? "14px 16px" : "16px 18px"}
            style={{ marginTop: 16, background: "rgba(26,58,47,0.04)", borderColor: "rgba(26,58,47,0.12)" }}
          >
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, margin: "0 0 6px" }}>
              Coaching match
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: "0 0 12px" }}>
              Head to Coaching to see coaches matched to your profile and goals — we don&apos;t auto-assign from the dashboard.
            </p>
            <button
              type="button"
              onClick={() => router.push("/coaching")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                fontWeight: 600,
                color: color.forest,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Browse matched coaches →
            </button>
          </ScoutBox>
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

      {scheduleOpen && (
        <GrowthDiscoveryModal trigger="dashboard_schedule" onClose={() => setScheduleOpen(false)} />
      )}
    </>
  );
}
