"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  formatCompactProfileLocation,
  parseProfileLocationString,
} from "@/lib/profile-location";
import {
  buildOnboardingProfilePatch,
  type OnboardingMatchingState,
  type RelocationId,
  type VisaNeedId,
  type WorkArrangementId,
} from "@/lib/onboarding-preferences";
import {
  ScoutHeader,
  ScreenWelcome,
  ScreenReadBack,
  ScreenTargetRoles,
  ScreenTargetCompanies,
  ScreenOnboardingLocation,
  ScreenOnboardingWorkArrangement,
  ScreenOnboardingRelocation,
  ScreenOnboardingVisa,
  ScreenOnboardingSalary,
  ScreenOnboardingTimeline,
  ScreenOnboardingAvoidRoles,
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

function saveMatchingPreferences(state: OnboardingMatchingState): Promise<void> {
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildOnboardingProfilePatch(state)),
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
  const [targetMarket, setTargetMarket] = useState("");
  const [fullyRemote, setFullyRemote] = useState(false);
  const [workArrangement, setWorkArrangement] = useState<WorkArrangementId>("");
  const [relocation, setRelocation] = useState<RelocationId>("");
  const [visaNeed, setVisaNeed] = useState<VisaNeedId>("");
  const [targetSalary, setTargetSalary] = useState("");
  const [jobTimeline, setJobTimeline] = useState("");
  const [deprioritizedRoles, setDeprioritizedRoles] = useState<string[]>([]);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState(false);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>(INITIAL_SETUP_STEPS);

  const goTo = useCallback((n: Screen) => setScreen(n), []);

  useEffect(() => {
    if (screen !== 3 || locationHintFetchedRef.current) return;
    locationHintFetchedRef.current = true;
    void fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { parsedData?: { location?: string | null } } | null) => {
        const raw = data?.parsedData?.location?.trim();
        if (!raw) return;
        const compact = formatCompactProfileLocation(parseProfileLocationString(raw)) ?? raw;
        setLocationHint(compact);
      })
      .catch(() => {});
  }, [screen]);

  const setStepStatus = useCallback((id: string, status: SetupStepStatus) => {
    setSetupSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const matchingState: OnboardingMatchingState = useMemo(
    () => ({
      targetMarket,
      fullyRemote,
      workArrangement,
      relocation,
      visaNeed,
      targetSalary,
      jobTimeline,
      deprioritizedRoles,
    }),
    [
      targetMarket,
      fullyRemote,
      workArrangement,
      relocation,
      visaNeed,
      targetSalary,
      jobTimeline,
      deprioritizedRoles,
    ],
  );

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

  const onWelcomeContinue = useCallback(() => {
    if (!resumeFilename || resumeError) return;
    if (liInput.trim()) void saveLinkedIn(liInput);
    goTo(1);
  }, [resumeFilename, resumeError, liInput, goTo]);

  const onLinkedInOnly = useCallback(() => {
    setReadbackStatus("skipped");
    if (liInput.trim()) void saveLinkedIn(liInput);
    goTo(2);
  }, [liInput, goTo]);

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
    goTo(2);
  }, [goTo]);

  const hasResumeTrack = !!(resumeFilename || resumeUploaded || resumeUploading);

  useEffect(() => {
    if (screen !== 1) return;
    if (!hasResumeTrack) {
      setReadbackStatus((s) => (s === "idle" ? "skipped" : s));
      return;
    }
    if (readbackStatus === "idle") {
      startBackgroundReadback();
    }
  }, [screen, hasResumeTrack, readbackStatus, startBackgroundReadback]);

  useEffect(() => {
    if (screen !== 1 || readbackStatus !== "pending" || readbackData) return;

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
      goTo(2);
    },
    [applyReadbackRoles, goTo],
  );

  const onReadBackSkip = useCallback(() => goTo(2), [goTo]);

  const onReadBackRefine = useCallback(() => {
    readbackStartedRef.current = false;
    setReadbackData(null);
    setReadbackStatus("idle");
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

  const persistMatchingAndGo = useCallback(
    async (next: Screen) => {
      await saveMatchingPreferences(matchingState);
      goTo(next);
    },
    [matchingState, goTo],
  );

  const onLocationContinue = useCallback(async () => {
    if (fullyRemote) setWorkArrangement("remote_only");
    await saveMatchingPreferences({
      ...matchingState,
      workArrangement: fullyRemote ? "remote_only" : matchingState.workArrangement,
      fullyRemote,
    });
    goTo(fullyRemote ? 5 : 4);
  }, [fullyRemote, matchingState, goTo]);

  const onLocationSkip = useCallback(async () => {
    await persistMatchingAndGo(fullyRemote ? 5 : 4);
  }, [fullyRemote, persistMatchingAndGo]);

  const onWorkArrangementContinue = useCallback(async () => {
    await persistMatchingAndGo(5);
  }, [persistMatchingAndGo]);

  const onWorkArrangementSkip = useCallback(async () => {
    await persistMatchingAndGo(5);
  }, [persistMatchingAndGo]);

  const onRelocationContinue = useCallback(async () => {
    await persistMatchingAndGo(6);
  }, [persistMatchingAndGo]);

  const onRelocationSkip = useCallback(async () => {
    await persistMatchingAndGo(6);
  }, [persistMatchingAndGo]);

  const onVisaContinue = useCallback(async () => {
    await persistMatchingAndGo(7);
  }, [persistMatchingAndGo]);

  const onVisaSkip = useCallback(async () => {
    await persistMatchingAndGo(7);
  }, [persistMatchingAndGo]);

  const onSalaryContinue = useCallback(async () => {
    await persistMatchingAndGo(8);
  }, [persistMatchingAndGo]);

  const onSalarySkip = useCallback(async () => {
    await persistMatchingAndGo(8);
  }, [persistMatchingAndGo]);

  const onTimelineContinue = useCallback(async () => {
    await persistMatchingAndGo(9);
  }, [persistMatchingAndGo]);

  const onTimelineSkip = useCallback(async () => {
    await persistMatchingAndGo(9);
  }, [persistMatchingAndGo]);

  const onAvoidContinue = useCallback(async () => {
    await persistMatchingAndGo(10);
  }, [persistMatchingAndGo]);

  const onAvoidSkip = useCallback(async () => {
    await persistMatchingAndGo(10);
  }, [persistMatchingAndGo]);

  const onFullyRemoteChange = useCallback((next: boolean) => {
    setFullyRemote(next);
    if (next) {
      setTargetMarket("");
      setWorkArrangement("remote_only");
    }
  }, []);

  const onToggleAvoidRole = useCallback((role: string) => {
    setDeprioritizedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role].slice(0, 10),
    );
  }, []);

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

  const runFinishSetup = useCallback(async () => {
    setSetupSteps(INITIAL_SETUP_STEPS.map((s) => ({ ...s, status: "pending" as SetupStepStatus })));
    goTo(11);

    let primaryAssetId: string | undefined;
    const companiesSnapshot = selectedCompanies;

    try {
      setStepStatus("profile", "active");
      await saveMatchingPreferences(matchingState);
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
    matchingState,
    goTo,
    liInput,
    selectedTitles,
    selectedCompanies,
    setStepStatus,
    router,
  ]);

  const onCompaniesContinue = useCallback(() => {
    void runFinishSetup();
  }, [runFinishSetup]);

  const onCompaniesSkip = useCallback(() => {
    void runFinishSetup();
  }, [runFinishSetup]);

  const demoAdvance = () => {
    if (screen === 0) {
      setResumeFilename("Sarah_Chen_Resume.pdf");
      window.setTimeout(() => {
        setResumeUploaded(true);
        startBackgroundReadback();
      }, 1300);
    } else if (screen < 10) {
      goTo((screen + 1) as Screen);
    } else if (screen === 10) {
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

  const headerScreen = (screen === 11 ? 10 : screen) as Screen;
  const showProcessingBanner =
    (screen === 0 && (resumeUploading || readbackStatus === "loading")) ||
    (screen === 1 && readbackStatus === "loading");

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
            <ScreenReadBack
              data={readbackData}
              status={readbackStatus}
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
            <ScreenOnboardingLocation
              targetMarket={targetMarket}
              fullyRemote={fullyRemote}
              locationHint={locationHint}
              onTargetMarketChange={setTargetMarket}
              onFullyRemoteChange={onFullyRemoteChange}
              onContinue={() => void onLocationContinue()}
              onSkip={() => void onLocationSkip()}
              onBack={() => goTo(2)}
            />
          )}
          {screen === 4 && (
            <ScreenOnboardingWorkArrangement
              workArrangement={workArrangement}
              onWorkArrangementChange={setWorkArrangement}
              onContinue={() => void onWorkArrangementContinue()}
              onSkip={() => void onWorkArrangementSkip()}
              onBack={() => goTo(3)}
            />
          )}
          {screen === 5 && (
            <ScreenOnboardingRelocation
              relocation={relocation}
              onRelocationChange={setRelocation}
              onContinue={() => void onRelocationContinue()}
              onSkip={() => void onRelocationSkip()}
              onBack={() => goTo(fullyRemote ? 3 : 4)}
            />
          )}
          {screen === 6 && (
            <ScreenOnboardingVisa
              visaNeed={visaNeed}
              onVisaNeedChange={setVisaNeed}
              onContinue={() => void onVisaContinue()}
              onSkip={() => void onVisaSkip()}
              onBack={() => goTo(5)}
            />
          )}
          {screen === 7 && (
            <ScreenOnboardingSalary
              targetSalary={targetSalary}
              onTargetSalaryChange={setTargetSalary}
              onContinue={() => void onSalaryContinue()}
              onSkip={() => void onSalarySkip()}
              onBack={() => goTo(6)}
            />
          )}
          {screen === 8 && (
            <ScreenOnboardingTimeline
              jobTimeline={jobTimeline}
              onJobTimelineChange={setJobTimeline}
              onContinue={() => void onTimelineContinue()}
              onSkip={() => void onTimelineSkip()}
              onBack={() => goTo(7)}
            />
          )}
          {screen === 9 && (
            <ScreenOnboardingAvoidRoles
              deprioritizedRoles={deprioritizedRoles}
              onToggleAvoidRole={onToggleAvoidRole}
              onContinue={() => void onAvoidContinue()}
              onSkip={() => void onAvoidSkip()}
              onBack={() => goTo(8)}
            />
          )}
          {screen === 10 && (
            <ScreenTargetCompanies
              selectedCompanies={selectedCompanies}
              targetRoles={selectedTitles}
              onAddCompany={onAddTargetCompany}
              onRemoveCompany={onRemoveTargetCompany}
              onContinue={onCompaniesContinue}
              onSkip={onCompaniesSkip}
            />
          )}
          {screen === 11 && <ScreenSetup steps={setupSteps} />}
        </div>
      </div>
      {process.env.NODE_ENV === "development" && screen !== 11 && <DemoNextButton onClick={demoAdvance} />}
    </div>
  );
}
