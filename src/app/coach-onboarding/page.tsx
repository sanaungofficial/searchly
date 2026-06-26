"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  CoachOnboardingHeader,
  CoachScreenCategory,
  CoachScreenCoachingExperience,
  CoachScreenExperienceLevel,
  CoachScreenExpertise,
  CoachScreenFinal,
  CoachScreenHeadline,
  CoachScreenLinkedIn,
  CoachScreenQualifications,
  CoachScreenReview,
  type CoachOnboardingScreen,
} from "@/components/scout/coach-onboarding-screens";
import { coachOnboardingAboutMe, coachOnboardingBio, type CoachOnboardingDraft } from "@/lib/coach-onboarding";

const INITIAL_DRAFT: CoachOnboardingDraft = {
  goal: "career",
  category: "",
  linkedinUrl: "",
  experienceLevel: "",
  specialties: [],
  industryYears: null,
  clientTier: "",
  qualifications: "",
  whyCoach: "",
  headline: "",
  isProfessionalCoach: false,
  clientSpecializations: [],
  photoUrl: "",
  displayName: "",
  hourlyRate: null,
  calLink: "",
};

export default function CoachOnboardingPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState<CoachOnboardingScreen>(0);
  const [draft, setDraft] = useState<CoachOnboardingDraft>(INITIAL_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const statusRes = await fetch("/api/coach/onboarding-status");
      if (statusRes.ok) {
        const status = await statusRes.json();
        if (status.complete) {
          if (status.phase === "vouches") {
            router.replace("/coach-onboarding/vouches");
            return;
          }
          if (status.phase === "portal") {
            router.replace("/clients");
            return;
          }
        }
        if (status.role !== "COACH" && status.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        if (status.profile) {
          const p = status.profile;
          setDraft((prev) => ({
            ...prev,
            category: p.category ?? prev.category,
            linkedinUrl: p.linkedinUrl ?? prev.linkedinUrl,
            headline: p.headline ?? prev.headline,
            qualifications: p.bio ?? prev.qualifications,
            specialties: p.specialties?.length ? p.specialties : prev.specialties,
            photoUrl: p.photoUrl ?? prev.photoUrl,
            displayName: p.displayName ?? prev.displayName,
          }));
        }
        if (status.displayName) {
          setDraft((prev) => ({ ...prev, displayName: status.displayName }));
        }
        if (status.avatarUrl && !status.profile?.photoUrl) {
          setDraft((prev) => ({ ...prev, photoUrl: status.avatarUrl }));
        }
      }

      setAuthChecked(true);
    });
  }, [router]);

  const patchDraft = useCallback((patch: Partial<CoachOnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const goTo = useCallback((n: CoachOnboardingScreen) => {
    setSubmitError(null);
    setScreen(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const submitProfile = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const bio = coachOnboardingBio(draft);
      const aboutMe = coachOnboardingAboutMe(draft);
      const res = await fetch("/api/coach/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: draft.displayName,
          category: draft.category,
          linkedinUrl: draft.linkedinUrl || null,
          headline: draft.headline,
          bio,
          aboutMe,
          whyCoach: draft.whyCoach || null,
          specialties: draft.specialties,
          clientSpecializations: draft.clientSpecializations,
          experienceLevel: draft.experienceLevel || null,
          clientTier: draft.clientTier || null,
          industryYears: draft.industryYears,
          isProfessionalCoach: draft.isProfessionalCoach,
          hourlyRate: draft.hourlyRate,
          calLink: draft.calLink || null,
          currentRole: draft.experienceLevel || null,
          photoUrl: draft.photoUrl || null,
          submitForReview: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit profile");

      await fetch("/api/coach/onboarding-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });

      router.push("/coach-onboarding/vouches?welcome=1");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  }, [draft, router]);

  if (!authChecked) {
    return (
      <div className="onboarding-loading" role="status" aria-live="polite">
        <div className="onboarding-loading__spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--scout-page)" }}>
      <div className="onboarding-shell">
        <CoachOnboardingHeader screen={screen} />
        <div className="onboarding-content">
          {screen === 0 && (
            <CoachScreenCategory draft={draft} onChange={patchDraft} onNext={() => goTo(1)} />
          )}
          {screen === 1 && (
            <CoachScreenLinkedIn
              draft={draft}
              onChange={patchDraft}
              onBack={() => goTo(0)}
              onNext={() => goTo(2)}
              onSkip={() => {
                patchDraft({ linkedinUrl: "" });
                goTo(2);
              }}
            />
          )}
          {screen === 2 && (
            <CoachScreenExperienceLevel draft={draft} onChange={patchDraft} onBack={() => goTo(1)} onNext={() => goTo(3)} />
          )}
          {screen === 3 && (
            <CoachScreenExpertise draft={draft} onChange={patchDraft} onBack={() => goTo(2)} onNext={() => goTo(4)} />
          )}
          {screen === 4 && (
            <CoachScreenCoachingExperience draft={draft} onChange={patchDraft} onBack={() => goTo(3)} onNext={() => goTo(5)} />
          )}
          {screen === 5 && (
            <CoachScreenQualifications draft={draft} onChange={patchDraft} onBack={() => goTo(4)} onNext={() => goTo(6)} />
          )}
          {screen === 6 && (
            <CoachScreenHeadline draft={draft} onChange={patchDraft} onBack={() => goTo(5)} onNext={() => goTo(7)} />
          )}
          {screen === 7 && (
            <CoachScreenFinal draft={draft} onChange={patchDraft} onBack={() => goTo(6)} onNext={() => goTo(8)} />
          )}
          {screen === 8 && (
            <>
              {submitError && (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#dc2626", marginBottom: 12 }}>{submitError}</p>
              )}
              <CoachScreenReview draft={draft} onBack={() => goTo(7)} onSubmit={submitProfile} submitting={submitting} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
