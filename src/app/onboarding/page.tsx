"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { resolvePostAuthRedirect } from "@/components/auth/post-auth-redirect";
import {
  ScoutHeader,
  ScreenWelcome,
  ScreenReadBack,
  ScreenTargetRoles,
  ScreenTargetCompanies,
  ScreenAboutYouSearch,
  ScreenAboutYouPreferences,
  ScreenSetup,
  DemoNextButton,
  OnboardingProcessingBanner,
  fetchReadbackWithRetry,
  type Screen,
  type ReadBackData,
  type ReadBackStatus,
  type SetupStep,
  type SetupStepStatus,
  type OnboardingCompanyPick,
} from "@/components/scout/screens";
import { ONBOARDING_MAX_TARGET_COMPANIES } from "@/lib/company-catalog";
import { linkedInHandleFromUrl, normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { writeOnboardingFinishPayload } from "@/lib/onboarding-finish";
import type { VoiceAgentFieldPatch, VoiceAgentSessionResult } from "@/components/voice/voice-intake-recorder";

function saveLinkedIn(handle: string): Promise<void> {
  const url = normalizeLinkedInUrl(handle);
  if (!url) return Promise.resolve();
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkedinUrl: url }),
  }).then(() => {});
}

async function importLinkedInProfile(handle: string): Promise<SetupStepStatus> {
  const url = normalizeLinkedInUrl(handle);
  if (!url) return "skipped";
  try {
    const res = await fetch("/api/profile/linkedin-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedinUrl: url }),
    });
    if (res.status === 503) return "skipped";
    return res.ok ? "done" : "skipped";
  } catch {
    return "skipped";
  }
}

function saveAboutYou(fields: {
  careerMotivation: string;
  jobTimeline: string;
  currentSalary: string;
  targetSalary: string;
  priorities: string[];
  attribution: string;
}): Promise<void> {
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      careerMotivation: fields.careerMotivation || null,
      jobTimeline: fields.jobTimeline || null,
      currentSalary: fields.currentSalary || null,
      targetSalary: fields.targetSalary || null,
      priorities: fields.priorities,
      attribution: fields.attribution || null,
    }),
  }).then(() => {});
}

function saveTargetRoles(roles: string[]): Promise<void> {
  if (!roles.length) return Promise.resolve();
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetRoles: roles }),
  }).then(() => {});
}

const INITIAL_SETUP_STEPS: SetupStep[] = [
  { id: "profile", label: "Saving your answers", status: "pending" },
  { id: "linkedin", label: "Importing your LinkedIn", status: "pending" },
  { id: "resume", label: "Setting up your resume", status: "pending" },
  { id: "analysis", label: "Reviewing your resume", status: "pending" },
  { id: "companies", label: "Scanning your target companies", status: "pending" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const destination = await resolvePostAuthRedirect();
        if (destination === "/dashboard") {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // Allow onboarding if sync fails
      }
      setAuthChecked(true);
    });
  }, [router]);

  const [screen, setScreen] = useState<Screen>(0);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [liInput, setLiInput] = useState("");
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<OnboardingCompanyPick[]>([]);
  const [readbackRoleSuggestions, setReadbackRoleSuggestions] = useState<string[]>([]);
  const [readbackData, setReadbackData] = useState<ReadBackData | null>(null);
  const [readbackStatus, setReadbackStatus] = useState<ReadBackStatus>("idle");
  const readbackStartedRef = useRef(false);
  const [careerMotivation, setCareerMotivation] = useState("");
  const [jobTimeline, setJobTimeline] = useState("");
  const [currentSalary, setCurrentSalary] = useState("");
  const [targetSalary, setTargetSalary] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [attribution, setAttribution] = useState("");
  const [resumeError, setResumeError] = useState(false);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>(INITIAL_SETUP_STEPS);

  const goTo = useCallback((n: Screen) => setScreen(n), []);

  const setStepStatus = useCallback((id: string, status: SetupStepStatus) => {
    setSetupSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const aboutYouFields = {
    careerMotivation,
    jobTimeline,
    currentSalary,
    targetSalary,
    priorities,
    attribution,
  };

  const applyReadbackRoles = useCallback((data: ReadBackData | null) => {
    if (!data?.targetRoles?.length) return;
    const roles = data.targetRoles.map((r) => r.role).filter(Boolean).slice(0, 20);
    setReadbackRoleSuggestions(roles);
    setSelectedTitles((prev) => (prev.length ? prev : roles));
  }, []);

  const startBackgroundReadback = useCallback(() => {
    if (readbackStartedRef.current) return;
    readbackStartedRef.current = true;
    setReadbackStatus("loading");

    void fetchReadbackWithRetry().then((result) => {
      if (result) {
        setReadbackData(result);
        setReadbackStatus("ready");
        applyReadbackRoles(result);
      } else {
        setReadbackStatus("pending");
      }
    });
  }, [applyReadbackRoles]);

  const processFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      setResumeFilename(file.name);
      setResumeUploaded(false);
      setResumeUploading(true);
      setResumeError(false);

      const formData = new FormData();
      formData.append("file", file);

      void fetch("/api/resume", { method: "POST", body: formData })
        .then(async (res) => {
          if (res.ok) {
            setResumeUploaded(true);
            if (liInput.trim()) await saveLinkedIn(liInput);
            startBackgroundReadback();
          } else {
            setResumeError(true);
            setResumeFilename(null);
            readbackStartedRef.current = false;
          }
        })
        .catch(() => {
          setResumeError(true);
          setResumeFilename(null);
          readbackStartedRef.current = false;
        })
        .finally(() => {
          setResumeUploading(false);
        });
    },
    [liInput, startBackgroundReadback],
  );

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) processFile(f);
  };
  const onFileClick = () => {
    const el = document.getElementById("scout-file") as HTMLInputElement | null;
    if (el) el.click();
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const onLIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.trim();
    if (/linkedin\.com/i.test(value)) {
      value = linkedInHandleFromUrl(value);
    }
    value = value.replace(/^@/, "").replace(/\//g, "");
    setLiInput(value);
  };

  const goToAboutYou = useCallback(() => {
    if (liInput.trim()) void saveLinkedIn(liInput);
    goTo(1);
  }, [liInput, goTo]);

  const onWelcomeContinue = useCallback(() => {
    if (!resumeFilename || resumeError) return;
    goToAboutYou();
  }, [resumeFilename, resumeError, goToAboutYou]);

  const onLinkedInOnly = useCallback(() => {
    setReadbackStatus("skipped");
    goToAboutYou();
  }, [goToAboutYou]);

  const onLIKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      if (resumeFilename && !resumeError) onWelcomeContinue();
      else if (liInput.trim()) onLinkedInOnly();
    },
    [resumeFilename, resumeError, liInput, onWelcomeContinue, onLinkedInOnly],
  );

  const onSkipProfile = useCallback(() => {
    setReadbackStatus("skipped");
    goTo(1);
  }, [goTo]);

  const hasResumeTrack = !!(resumeFilename || resumeUploaded || resumeUploading);

  useEffect(() => {
    if (screen !== 3) return;
    if (!hasResumeTrack) {
      setReadbackStatus((s) => (s === "idle" ? "skipped" : s));
      return;
    }
    if (readbackStatus === "idle") {
      startBackgroundReadback();
    }
  }, [screen, hasResumeTrack, readbackStatus, startBackgroundReadback]);

  useEffect(() => {
    if (screen !== 3 || readbackStatus !== "pending" || readbackData) return;

    const poll = () => {
      void fetch("/api/ai/readback", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.picture && Array.isArray(d.strengths)) {
            const payload = d as ReadBackData;
            setReadbackData(payload);
            setReadbackStatus("ready");
            applyReadbackRoles(payload);
          }
        })
        .catch(() => {});
    };

    const id = window.setInterval(poll, 5000);
    return () => window.clearInterval(id);
  }, [screen, readbackStatus, readbackData, applyReadbackRoles]);

  const onAddTargetRole = useCallback((title: string) => {
    setSelectedTitles((prev) => {
      if (prev.includes(title) || prev.length >= 3) return prev;
      return [...prev, title];
    });
  }, []);

  const onRemoveTargetRole = useCallback((title: string) => {
    setSelectedTitles((prev) => prev.filter((t) => t !== title));
  }, []);

  const onReadBackConfirm = useCallback(
    (data: ReadBackData | null) => {
      applyReadbackRoles(data);
      goTo(4);
    },
    [applyReadbackRoles, goTo],
  );

  const onReadBackSkip = useCallback(() => goTo(4), [goTo]);

  const onReadBackRefine = useCallback(() => {
    readbackStartedRef.current = false;
    setReadbackData(null);
    setReadbackStatus("idle");
    goTo(0);
  }, [goTo]);

  const goToReadbackOrRoles = useCallback(() => {
    if (hasResumeTrack && readbackStatus !== "skipped") goTo(3);
    else goTo(4);
  }, [hasResumeTrack, readbackStatus, goTo]);

  const onAboutSearchContinue = useCallback(() => goTo(2), [goTo]);

  const onAboutSearchSkip = useCallback(() => {
    goToReadbackOrRoles();
  }, [goToReadbackOrRoles]);

  const onAboutPrefsContinue = useCallback(async () => {
    await saveAboutYou(aboutYouFields);
    goToReadbackOrRoles();
  }, [aboutYouFields, goToReadbackOrRoles]);

  const onAboutPrefsSkip = useCallback(async () => {
    await saveAboutYou(aboutYouFields);
    goToReadbackOrRoles();
  }, [aboutYouFields, goToReadbackOrRoles]);

  const onRolesContinue = useCallback(async () => {
    await saveTargetRoles(selectedTitles);
    goTo(5);
  }, [selectedTitles, goTo]);

  const onRolesSkip = useCallback(async () => {
    await saveTargetRoles(selectedTitles);
    goTo(5);
  }, [selectedTitles, goTo]);

  const onAddTargetCompany = useCallback((company: OnboardingCompanyPick) => {
    setSelectedCompanies((prev) => {
      if (prev.some((c) => c.catalogSlug === company.catalogSlug) || prev.length >= ONBOARDING_MAX_TARGET_COMPANIES) {
        return prev;
      }
      return [...prev, company];
    });
  }, []);

  const onRemoveTargetCompany = useCallback((catalogSlug: string) => {
    setSelectedCompanies((prev) => prev.filter((c) => c.catalogSlug !== catalogSlug));
  }, []);

  const onTogglePriority = useCallback((p: string) => {
    setPriorities((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }, []);

  const applyVoiceFieldPatch = useCallback((patch: VoiceAgentFieldPatch) => {
    if (patch.careerMotivation) setCareerMotivation(patch.careerMotivation);
    if (patch.jobTimeline) setJobTimeline(patch.jobTimeline);
    if (patch.currentSalary) setCurrentSalary(patch.currentSalary);
    if (patch.targetSalary) setTargetSalary(patch.targetSalary);
    if (patch.priorities?.length) {
      setPriorities((prev) => [...new Set([...prev, ...patch.priorities!])]);
    }
    if (patch.targetRoles?.length) {
      setReadbackRoleSuggestions((prev) => [...new Set([...prev, ...patch.targetRoles!])]);
      setSelectedTitles((prev) => [...new Set([...prev, ...patch.targetRoles!])]);
    }
  }, []);

  const onVoiceIntakeComplete = useCallback((result: VoiceAgentSessionResult) => {
    if (result.transcript) {
      void fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyIntakeNotes: result.transcript }),
      });
    }
  }, []);

  const runFinishSetup = useCallback(async () => {
    setSetupSteps(INITIAL_SETUP_STEPS.map((s) => ({ ...s, status: "pending" as SetupStepStatus })));
    goTo(6);

    let primaryAssetId: string | undefined;
    const companiesSnapshot = selectedCompanies;

    try {
      setStepStatus("profile", "active");
      await saveAboutYou(aboutYouFields);
      await saveTargetRoles(selectedTitles);
      if (liInput.trim()) await saveLinkedIn(liInput);
      setStepStatus("profile", "done");

      if (liInput.trim()) {
        setStepStatus("linkedin", "active");
        setStepStatus("linkedin", await importLinkedInProfile(liInput));
      } else {
        setStepStatus("linkedin", "skipped");
      }

      setStepStatus("resume", "active");
      const assetsRes = await fetch("/api/assets");
      const assets = await assetsRes.json();
      const primary = Array.isArray(assets)
        ? assets.find((a: { type: string; isPrimary: boolean }) => a.type === "RESUME" && a.isPrimary)
          ?? assets.find((a: { type: string }) => a.type === "RESUME")
        : undefined;
      primaryAssetId = primary?.id;
      setStepStatus("resume", primaryAssetId ? "done" : "skipped");

      if (primaryAssetId) {
        setStepStatus("analysis", "active");
        await fetch(`/api/assets/${primaryAssetId}/analysis`).catch(() => {});
        setStepStatus("analysis", "done");
      } else {
        setStepStatus("analysis", "skipped");
      }

      if (companiesSnapshot.length > 0) {
        setStepStatus("companies", "active");
        for (const pick of companiesSnapshot) {
          const res = await fetch("/api/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              catalogSlug: pick.catalogSlug,
              name: pick.name,
              website: pick.website,
              careersUrl: pick.careersUrl,
              type: pick.type,
            }),
          });
          let trackedId: string | null = null;
          if (res.ok) {
            const created = await res.json();
            trackedId = created.id ?? null;
          } else if (res.status === 409) {
            const data = await res.json();
            trackedId = data.existing?.id ?? null;
          }
          if (trackedId) {
            await fetch(`/api/companies/${trackedId}/refresh`, { method: "POST" }).catch(() => {});
          }
        }
        setStepStatus("companies", "done");
      } else {
        setStepStatus("companies", "skipped");
      }

      writeOnboardingFinishPayload({
        primaryAssetId,
        autoRunMatch: false,
      });

      await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-onboarding" }),
      }).catch(() => {});

      router.push("/dashboard");
    } catch {
      await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-onboarding" }),
      }).catch(() => {});
      writeOnboardingFinishPayload({ primaryAssetId, autoRunMatch: false });
      router.push("/dashboard");
    }
  }, [
    aboutYouFields,
    goTo,
    liInput,
    selectedTitles,
    selectedCompanies,
    setStepStatus,
    router,
  ]);

  const onCompaniesContinue = useCallback(() => {
    saveAboutYou(aboutYouFields).catch(() => {});
    void runFinishSetup();
  }, [aboutYouFields, runFinishSetup]);

  const onCompaniesSkip = useCallback(() => {
    saveAboutYou(aboutYouFields).catch(() => {});
    void runFinishSetup();
  }, [aboutYouFields, runFinishSetup]);

  const demoAdvance = () => {
    if (screen === 0) {
      setResumeFilename("Sarah_Chen_Resume.pdf");
      window.setTimeout(() => {
        setResumeUploaded(true);
        startBackgroundReadback();
      }, 1300);
    } else if (screen === 1) {
      goTo(2);
    } else if (screen === 2) {
      goTo(3);
    } else if (screen === 3) {
      goTo(4);
    } else if (screen === 4) {
      goTo(5);
    } else if (screen === 5) {
      void runFinishSetup();
    }
  };

  if (!authChecked) {
    return (
      <div className="onboarding-loading" role="status" aria-live="polite">
        <span style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">🥬</span>
        <div className="onboarding-loading__spinner" aria-hidden="true" />
        <span>One sec…</span>
      </div>
    );
  }

  const headerScreen = screen === 6 ? 5 : screen;
  const showProcessingBanner =
    screen >= 1 && screen <= 2 && (resumeUploading || readbackStatus === "loading");

  return (
    <div style={{ background: "var(--scout-page)" }}>
      <input
        id="scout-file"
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: "none" }}
        onChange={onFileChange}
      />
      <div className="onboarding-shell">
        <ScoutHeader screen={headerScreen} />
        <div className="onboarding-content">
          {showProcessingBanner && (
            <OnboardingProcessingBanner
              resumeUploading={resumeUploading}
              readbackLoading={readbackStatus === "loading"}
            />
          )}
          {screen === 0 && (
            <ScreenWelcome
              resumeFilename={resumeFilename}
              resumeUploaded={resumeUploaded}
              resumeUploading={resumeUploading}
              resumeError={resumeError}
              isDragging={isDragging}
              liInput={liInput}
              onLIChange={onLIChange}
              onLIKey={onLIKey}
              onContinue={onWelcomeContinue}
              onLinkedInOnly={onLinkedInOnly}
              onStartFromScratch={onSkipProfile}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFileClick={onFileClick}
              onFileChange={onFileChange}
            />
          )}
          {screen === 1 && (
            <ScreenAboutYouSearch
              careerMotivation={careerMotivation}
              jobTimeline={jobTimeline}
              onCareerMotivationChange={setCareerMotivation}
              onJobTimelineChange={setJobTimeline}
              onVoiceFieldUpdate={applyVoiceFieldPatch}
              onVoiceIntakeComplete={onVoiceIntakeComplete}
              onContinue={onAboutSearchContinue}
              onSkip={onAboutSearchSkip}
            />
          )}
          {screen === 2 && (
            <ScreenAboutYouPreferences
              jobTimeline={jobTimeline}
              currentSalary={currentSalary}
              targetSalary={targetSalary}
              priorities={priorities}
              attribution={attribution}
              onCurrentSalaryChange={setCurrentSalary}
              onTargetSalaryChange={setTargetSalary}
              onTogglePriority={onTogglePriority}
              onAttributionChange={setAttribution}
              onVoiceFieldUpdate={applyVoiceFieldPatch}
              onVoiceIntakeComplete={onVoiceIntakeComplete}
              onContinue={onAboutPrefsContinue}
              onSkip={onAboutPrefsSkip}
            />
          )}
          {screen === 3 && (
            <ScreenReadBack
              data={readbackData}
              status={readbackStatus}
              onConfirm={onReadBackConfirm}
              onRefine={onReadBackRefine}
              onSkip={onReadBackSkip}
            />
          )}
          {screen === 4 && (
            <ScreenTargetRoles
              selectedTitles={selectedTitles}
              suggestedTitles={readbackRoleSuggestions}
              onAddTitle={onAddTargetRole}
              onRemoveTitle={onRemoveTargetRole}
              onContinue={onRolesContinue}
              onSkip={onRolesSkip}
            />
          )}
          {screen === 5 && (
            <ScreenTargetCompanies
              selectedCompanies={selectedCompanies}
              targetRoles={selectedTitles}
              onAddCompany={onAddTargetCompany}
              onRemoveCompany={onRemoveTargetCompany}
              onContinue={onCompaniesContinue}
              onSkip={onCompaniesSkip}
            />
          )}
          {screen === 6 && <ScreenSetup steps={setupSteps} />}
        </div>
      </div>
      {process.env.NODE_ENV === "development" && screen !== 6 && <DemoNextButton onClick={demoAdvance} />}
    </div>
  );
}
