"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  formatCompactProfileLocation,
  parseProfileLocationString,
} from "@/lib/profile-location";
import {
  ScoutHeader,
  ScreenWelcome,
  ScreenReadBack,
  ScreenTargetRoles,
  ScreenTargetCompanies,
  ScreenCareerMotivation,
  ScreenJobTimeline,
  ScreenTargetLocation,
  ScreenCurrentSalary,
  ScreenTargetSalary,
  ScreenPriorities,
  ScreenAttribution,
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
  targetMarket: string;
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
      targetMarket: fields.targetMarket || null,
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

const ONBOARDING = {
  WELCOME: 0,
  MOTIVATION: 1,
  TIMELINE: 2,
  LOCATION: 3,
  CURRENT_SALARY: 4,
  TARGET_SALARY: 5,
  PRIORITIES: 6,
  ATTRIBUTION: 7,
  READBACK: 8,
  ROLES: 9,
  COMPANIES: 10,
  SETUP: 11,
} as const satisfies Record<string, Screen>;

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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
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
  const locationHintFetchedRef = useRef(false);
  const [careerMotivation, setCareerMotivation] = useState("");
  const [jobTimeline, setJobTimeline] = useState("");
  const [currentSalary, setCurrentSalary] = useState("");
  const [targetSalary, setTargetSalary] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [attribution, setAttribution] = useState("");
  const [resumeError, setResumeError] = useState(false);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>(INITIAL_SETUP_STEPS);

  const goTo = useCallback((n: Screen) => setScreen(n), []);

  useEffect(() => {
    if (screen !== ONBOARDING.LOCATION || locationHintFetchedRef.current) return;
    locationHintFetchedRef.current = true;
    void fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { parsedData?: { location?: string | null } } | null) => {
        const raw = data?.parsedData?.location?.trim();
        if (!raw) return;
        const compact =
          formatCompactProfileLocation(parseProfileLocationString(raw)) ?? raw;
        setLocationHint(compact);
      })
      .catch(() => {});
  }, [screen]);

  const setStepStatus = useCallback((id: string, status: SetupStepStatus) => {
    setSetupSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const aboutYouFields = {
    careerMotivation,
    jobTimeline,
    currentSalary,
    targetSalary,
    targetMarket,
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
    goTo(ONBOARDING.MOTIVATION);
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
    goTo(ONBOARDING.MOTIVATION);
  }, [goTo]);

  const hasResumeTrack = !!(resumeFilename || resumeUploaded || resumeUploading);

  useEffect(() => {
    if (screen !== ONBOARDING.READBACK) return;
    if (!hasResumeTrack) {
      setReadbackStatus((s) => (s === "idle" ? "skipped" : s));
      return;
    }
    if (readbackStatus === "idle") {
      startBackgroundReadback();
    }
  }, [screen, hasResumeTrack, readbackStatus, startBackgroundReadback]);

  useEffect(() => {
    if (screen !== ONBOARDING.READBACK || readbackStatus !== "pending" || readbackData) return;

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
      goTo(ONBOARDING.ROLES);
    },
    [applyReadbackRoles, goTo],
  );

  const onReadBackSkip = useCallback(() => goTo(ONBOARDING.ROLES), [goTo]);

  const onReadBackRefine = useCallback(() => {
    readbackStartedRef.current = false;
    setReadbackData(null);
    setReadbackStatus("idle");
    goTo(ONBOARDING.WELCOME);
  }, [goTo]);

  const goToReadbackOrRoles = useCallback(() => {
    if (hasResumeTrack && readbackStatus !== "skipped") goTo(ONBOARDING.READBACK);
    else goTo(ONBOARDING.ROLES);
  }, [hasResumeTrack, readbackStatus, goTo]);

  const finishAboutYou = useCallback(async () => {
    await saveAboutYou(aboutYouFields);
    goToReadbackOrRoles();
  }, [aboutYouFields, goToReadbackOrRoles]);

  const onAboutQuestionContinue = useCallback(
    (from: Screen) => {
      if (from < ONBOARDING.ATTRIBUTION) goTo((from + 1) as Screen);
      else void finishAboutYou();
    },
    [goTo, finishAboutYou],
  );

  const onAboutQuestionSkip = useCallback(() => {
    void finishAboutYou();
  }, [finishAboutYou]);

  const onRolesContinue = useCallback(async () => {
    await saveTargetRoles(selectedTitles);
    goTo(ONBOARDING.COMPANIES);
  }, [selectedTitles, goTo]);

  const onRolesSkip = useCallback(async () => {
    await saveTargetRoles(selectedTitles);
    goTo(ONBOARDING.COMPANIES);
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

  const runFinishSetup = useCallback(async () => {
    setSetupSteps(INITIAL_SETUP_STEPS.map((s) => ({ ...s, status: "pending" as SetupStepStatus })));
    goTo(ONBOARDING.SETUP);

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
    if (screen === ONBOARDING.WELCOME) {
      setResumeFilename("Sarah_Chen_Resume.pdf");
      window.setTimeout(() => {
        setResumeUploaded(true);
        startBackgroundReadback();
      }, 1300);
    } else if (screen < ONBOARDING.COMPANIES) {
      goTo((screen + 1) as Screen);
    } else if (screen === ONBOARDING.COMPANIES) {
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

  const headerScreen = screen >= ONBOARDING.COMPANIES ? ONBOARDING.COMPANIES : screen;
  const showProcessingBanner =
    screen >= ONBOARDING.MOTIVATION &&
    screen <= ONBOARDING.ATTRIBUTION &&
    (resumeUploading || readbackStatus === "loading");

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
          {screen === ONBOARDING.WELCOME && (
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
          {screen === ONBOARDING.MOTIVATION && (
            <ScreenCareerMotivation
              careerMotivation={careerMotivation}
              onCareerMotivationChange={setCareerMotivation}
              onContinue={() => onAboutQuestionContinue(ONBOARDING.MOTIVATION)}
              onSkip={onAboutQuestionSkip}
            />
          )}
          {screen === ONBOARDING.TIMELINE && (
            <ScreenJobTimeline
              jobTimeline={jobTimeline}
              onJobTimelineChange={setJobTimeline}
              onContinue={() => onAboutQuestionContinue(ONBOARDING.TIMELINE)}
              onSkip={onAboutQuestionSkip}
            />
          )}
          {screen === ONBOARDING.LOCATION && (
            <ScreenTargetLocation
              targetMarket={targetMarket}
              locationHint={locationHint}
              onTargetMarketChange={setTargetMarket}
              onContinue={() => onAboutQuestionContinue(ONBOARDING.LOCATION)}
              onSkip={onAboutQuestionSkip}
            />
          )}
          {screen === ONBOARDING.CURRENT_SALARY && (
            <ScreenCurrentSalary
              currentSalary={currentSalary}
              onCurrentSalaryChange={setCurrentSalary}
              onContinue={() => onAboutQuestionContinue(ONBOARDING.CURRENT_SALARY)}
              onSkip={onAboutQuestionSkip}
            />
          )}
          {screen === ONBOARDING.TARGET_SALARY && (
            <ScreenTargetSalary
              targetSalary={targetSalary}
              onTargetSalaryChange={setTargetSalary}
              onContinue={() => onAboutQuestionContinue(ONBOARDING.TARGET_SALARY)}
              onSkip={onAboutQuestionSkip}
            />
          )}
          {screen === ONBOARDING.PRIORITIES && (
            <ScreenPriorities
              priorities={priorities}
              onTogglePriority={onTogglePriority}
              onContinue={() => onAboutQuestionContinue(ONBOARDING.PRIORITIES)}
              onSkip={onAboutQuestionSkip}
            />
          )}
          {screen === ONBOARDING.ATTRIBUTION && (
            <ScreenAttribution
              attribution={attribution}
              onAttributionChange={setAttribution}
              onContinue={() => onAboutQuestionContinue(ONBOARDING.ATTRIBUTION)}
              onSkip={onAboutQuestionSkip}
            />
          )}
          {screen === ONBOARDING.READBACK && (
            <ScreenReadBack
              data={readbackData}
              status={readbackStatus}
              onConfirm={onReadBackConfirm}
              onRefine={onReadBackRefine}
              onSkip={onReadBackSkip}
            />
          )}
          {screen === ONBOARDING.ROLES && (
            <ScreenTargetRoles
              selectedTitles={selectedTitles}
              suggestedTitles={readbackRoleSuggestions}
              onAddTitle={onAddTargetRole}
              onRemoveTitle={onRemoveTargetRole}
              onContinue={onRolesContinue}
              onSkip={onRolesSkip}
            />
          )}
          {screen === ONBOARDING.COMPANIES && (
            <ScreenTargetCompanies
              selectedCompanies={selectedCompanies}
              targetRoles={selectedTitles}
              onAddCompany={onAddTargetCompany}
              onRemoveCompany={onRemoveTargetCompany}
              onContinue={onCompaniesContinue}
              onSkip={onCompaniesSkip}
            />
          )}
          {screen === ONBOARDING.SETUP && <ScreenSetup steps={setupSteps} />}
        </div>
      </div>
      {process.env.NODE_ENV === "development" && screen !== ONBOARDING.SETUP && (
        <DemoNextButton onClick={demoAdvance} />
      )}
    </div>
  );
}
