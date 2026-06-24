"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
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
  type Screen,
  type ReadBackData,
  type SetupStep,
  type SetupStepStatus,
  type OnboardingCompanyPick,
} from "@/components/scout/screens";
import { ONBOARDING_MAX_TARGET_COMPANIES } from "@/lib/company-catalog";
import { linkedInHandleFromUrl, normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { writeOnboardingFinishPayload } from "@/lib/onboarding-finish";

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
  { id: "profile", label: "Saving your profile", status: "pending" },
  { id: "linkedin", label: "Importing your LinkedIn profile", status: "pending" },
  { id: "resume", label: "Building your base resume", status: "pending" },
  { id: "analysis", label: "Running your resume review", status: "pending" },
  { id: "companies", label: "Scanning your companies for matching roles", status: "pending" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  const [screen, setScreen] = useState<Screen>(0);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [liInput, setLiInput] = useState("");
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<OnboardingCompanyPick[]>([]);
  const [readbackRoleSuggestions, setReadbackRoleSuggestions] = useState<string[]>([]);
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

  const processFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setResumeFilename(file.name);
    setResumeUploaded(false);
    setResumeError(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: formData });
      if (res.ok) {
        setResumeUploaded(true);
        if (liInput.trim()) await saveLinkedIn(liInput);
        goTo(1);
      } else {
        setResumeError(true);
        setResumeFilename(null);
      }
    } catch {
      setResumeError(true);
      setResumeFilename(null);
    }
  }, [goTo, liInput]);

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

  const onWelcomeContinue = useCallback(() => {
    if (!resumeUploaded) return;
    if (liInput.trim()) void saveLinkedIn(liInput);
    goTo(1);
  }, [liInput, resumeUploaded, goTo]);

  const onLinkedInOnly = useCallback(() => {
    void saveLinkedIn(liInput);
    goTo(2);
  }, [liInput, goTo]);

  const onLIKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (resumeUploaded) onWelcomeContinue();
    else if (liInput.trim()) onLinkedInOnly();
  }, [resumeUploaded, liInput, onWelcomeContinue, onLinkedInOnly]);

  const onSkipProfile = useCallback(() => goTo(2), [goTo]);

  useEffect(() => {
    if (screen !== 2 || readbackRoleSuggestions.length > 0) return;
    fetch("/api/ai/readback")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.targetRoles)) {
          setReadbackRoleSuggestions(
            data.targetRoles
              .map((r: { role?: string }) => r.role?.trim())
              .filter(Boolean) as string[]
          );
        }
      })
      .catch(() => {});
  }, [screen, readbackRoleSuggestions.length]);

  const onAddTargetRole = useCallback((title: string) => {
    setSelectedTitles((prev) => {
      if (prev.includes(title) || prev.length >= 3) return prev;
      return [...prev, title];
    });
  }, []);

  const onRemoveTargetRole = useCallback((title: string) => {
    setSelectedTitles((prev) => prev.filter((t) => t !== title));
  }, []);

  const onReadBackConfirm = useCallback((data: ReadBackData | null) => {
    if (data?.targetRoles?.length) {
      const roles = data.targetRoles.map((r) => r.role).filter(Boolean).slice(0, 3);
      setReadbackRoleSuggestions(roles);
      setSelectedTitles((prev) => (prev.length ? prev : roles));
    }
    goTo(2);
  }, [goTo]);

  const onReadBackSkip = useCallback(() => goTo(2), [goTo]);

  const onReadBackRefine = useCallback(() => {
    goTo(0);
  }, [goTo]);

  const onRolesContinue = useCallback(async () => {
    await saveTargetRoles(selectedTitles);
    goTo(3);
  }, [selectedTitles, goTo]);

  const onRolesSkip = useCallback(async () => {
    await saveTargetRoles(selectedTitles);
    goTo(3);
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

  const onCompaniesContinue = useCallback(() => goTo(4), [goTo]);
  const onCompaniesSkip = useCallback(() => goTo(4), [goTo]);

  const onTogglePriority = useCallback((p: string) => {
    setPriorities((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }, []);

  const goToPreferences = useCallback(() => goTo(5), [goTo]);

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

      fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-onboarding" }),
      }).catch(() => {});

      const finishDestination =
        companiesSnapshot.length > 0 ? "/opportunities/companies" : "/profile/dream-role";

      router.push(finishDestination);
    } catch {
      fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-onboarding" }),
      }).catch(() => {});
      writeOnboardingFinishPayload({ primaryAssetId, autoRunMatch: false });
      router.push(
        companiesSnapshot.length > 0 ? "/opportunities/companies" : "/profile/dream-role"
      );
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

  const finishOnboarding = useCallback(() => {
    saveAboutYou(aboutYouFields).catch(() => {});
    void runFinishSetup();
  }, [aboutYouFields, runFinishSetup]);

  const demoAdvance = () => {
    if (screen === 0) {
      setResumeFilename("Sarah_Chen_Resume.pdf");
      window.setTimeout(() => setResumeUploaded(true), 1300);
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
        <div className="onboarding-loading__spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  const headerScreen = screen === 6 ? 5 : screen;

  return (
    <div style={{ background: "#F7F5F2" }}>
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
          {screen === 0 && (
            <ScreenWelcome
              resumeFilename={resumeFilename}
              resumeUploaded={resumeUploaded}
              resumeError={resumeError}
              isDragging={isDragging}
              liInput={liInput}
              onLIChange={onLIChange}
              onLIKey={onLIKey}
              onContinue={onWelcomeContinue}
              onLinkedInOnly={onLinkedInOnly}
              onSkip={onSkipProfile}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFileClick={onFileClick}
              onFileChange={onFileChange}
            />
          )}
          {screen === 1 && (
            <ScreenReadBack
              onConfirm={onReadBackConfirm}
              onRefine={onReadBackRefine}
              onSkip={onReadBackSkip}
            />
          )}
          {screen === 2 && (
            <ScreenTargetRoles
              selectedTitles={selectedTitles}
              suggestedTitles={readbackRoleSuggestions}
              onAddTitle={onAddTargetRole}
              onRemoveTitle={onRemoveTargetRole}
              onContinue={onRolesContinue}
              onSkip={onRolesSkip}
            />
          )}
          {screen === 3 && (
            <ScreenTargetCompanies
              selectedCompanies={selectedCompanies}
              targetRoles={selectedTitles}
              onAddCompany={onAddTargetCompany}
              onRemoveCompany={onRemoveTargetCompany}
              onContinue={onCompaniesContinue}
              onSkip={onCompaniesSkip}
            />
          )}
          {screen === 4 && (
            <ScreenAboutYouSearch
              careerMotivation={careerMotivation}
              jobTimeline={jobTimeline}
              onCareerMotivationChange={setCareerMotivation}
              onJobTimelineChange={setJobTimeline}
              onContinue={goToPreferences}
              onSkip={finishOnboarding}
            />
          )}
          {screen === 5 && (
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
              onContinue={finishOnboarding}
              onSkip={finishOnboarding}
            />
          )}
          {screen === 6 && <ScreenSetup steps={setupSteps} />}
        </div>
      </div>
      {process.env.NODE_ENV === "development" && screen !== 6 && <DemoNextButton onClick={demoAdvance} />}
    </div>
  );
}
