"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ScoutHeader,
  ScreenWelcome,
  ScreenReadBack,
  ScreenTargetRoles,
  ScreenAboutYouSearch,
  ScreenAboutYouPreferences,
  ScreenTransition,
  ScreenSetup,
  DemoNextButton,
  type Screen,
  type ReadBackData,
  type TransitionJobAnalysis,
  type TransitionJobMatch,
  type SetupStep,
  type SetupStepStatus,
} from "@/components/scout/screens";
import { linkedInHandleFromUrl, normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { writeOnboardingFinishPayload } from "@/lib/onboarding-finish";
import { normalizeJobListingUrl } from "@/lib/job-listing-url";

function saveLinkedIn(handle: string): Promise<void> {
  const url = normalizeLinkedInUrl(handle);
  if (!url) return Promise.resolve();
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkedinUrl: url }),
  }).then(() => {});
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

const INITIAL_SETUP_STEPS: SetupStep[] = [
  { id: "profile", label: "Saving your profile", status: "pending" },
  { id: "resume", label: "Building your base resume", status: "pending" },
  { id: "analysis", label: "Running your resume review", status: "pending" },
  { id: "job", label: "Saving your first job", status: "pending" },
  { id: "match", label: "Scoring your fit for this role", status: "pending" },
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
  const [readbackRoleSuggestions, setReadbackRoleSuggestions] = useState<string[]>([]);
  const [careerMotivation, setCareerMotivation] = useState("");
  const [jobTimeline, setJobTimeline] = useState("");
  const [currentSalary, setCurrentSalary] = useState("");
  const [targetSalary, setTargetSalary] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [attribution, setAttribution] = useState("");
  const [resumeError, setResumeError] = useState(false);
  const [jobUrl, setJobUrl] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobLoadingPhase, setJobLoadingPhase] = useState<"parse" | "match" | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobMatchError, setJobMatchError] = useState<string | null>(null);
  const [jobAnalysis, setJobAnalysis] = useState<TransitionJobAnalysis | null>(null);
  const [jobMatch, setJobMatch] = useState<TransitionJobMatch | null>(null);
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
      setReadbackRoleSuggestions(data.targetRoles.map((r) => r.role).filter(Boolean));
    }
    goTo(2);
  }, [goTo]);

  const onReadBackSkip = useCallback(() => goTo(2), [goTo]);

  const onReadBackRefine = useCallback(() => {
    goTo(0);
  }, [goTo]);

  const onRolesContinue = useCallback(() => {
    if (selectedTitles.length) {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRoles: selectedTitles }),
      }).catch(() => {});
    }
    goTo(3);
  }, [selectedTitles, goTo]);

  const onRolesSkip = useCallback(() => goTo(3), [goTo]);

  const onTogglePriority = useCallback((p: string) => {
    setPriorities((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }, []);

  const goToPreferences = useCallback(() => goTo(4), [goTo]);

  const goToTransition = useCallback(() => {
    saveAboutYou(aboutYouFields).catch(() => {});
    goTo(5);
  }, [aboutYouFields, goTo]);

  const skipAboutYouToTransition = useCallback(() => {
    saveAboutYou(aboutYouFields).catch(() => {});
    goTo(5);
  }, [aboutYouFields, goTo]);

  const analyzeFirstJob = useCallback(async () => {
    const normalized = normalizeJobListingUrl(jobUrl);
    if (!normalized.ok) {
      setJobError(normalized.error);
      return;
    }
    if (normalized.normalized) {
      setJobUrl(normalized.url);
    }

    const url = normalized.url;
    setJobLoading(true);
    setJobLoadingPhase("parse");
    setJobError(null);
    setJobMatchError(null);
    setJobAnalysis(null);
    setJobMatch(null);
    try {
      const res = await fetch("/api/ai/parse-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJobError(data.error ?? "Could not read that URL. Try another listing link.");
        return;
      }

      const analysis: TransitionJobAnalysis = {
        company: data.company ?? null,
        role: data.role ?? null,
        location: data.location ?? null,
        salary: data.salary ?? null,
        description: data.description ?? null,
        requirements: data.requirements ?? [],
      };
      setJobAnalysis(analysis);

      if (!analysis.description) {
        setJobMatchError("We saved the listing details but couldn't score your fit without a job description.");
        return;
      }

      setJobLoadingPhase("match");
      const matchRes = await fetch("/api/ai/job-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: analysis.role ?? "Unknown Role",
          company: analysis.company ?? "Unknown Company",
          description: analysis.description,
        }),
      });
      const matchData = await matchRes.json();
      if (!matchRes.ok) {
        if (matchRes.status === 404) {
          setJobMatchError("Upload a resume to see your match score — you can still finish setup.");
        } else if (matchRes.status === 503) {
          setJobMatchError("Fit scoring isn't available here yet — we'll open your resume and you can run match in production.");
        } else {
          setJobMatchError(matchData.error ?? "Couldn't score your fit right now. You can still finish setup.");
        }
        return;
      }

      if (typeof matchData.score === "number") {
        setJobMatch({
          score: matchData.score,
          scoreLabel: matchData.scoreLabel ?? "Fair",
          summaryNote: matchData.summaryNote ?? "",
        });
      }
    } catch {
      setJobError("Network error — please try again.");
    } finally {
      setJobLoading(false);
      setJobLoadingPhase(null);
    }
  }, [jobUrl]);

  const runFinishSetup = useCallback(async (saveJob: boolean) => {
    setSetupSteps(INITIAL_SETUP_STEPS.map((s) => ({ ...s, status: "pending" as SetupStepStatus })));
    goTo(6);

    let primaryAssetId: string | undefined;
    let savedJobId: string | null = null;
    const analysisSnapshot = jobAnalysis;
    const matchSnapshot = jobMatch;

    try {
      setStepStatus("profile", "active");
      await saveAboutYou(aboutYouFields);
      if (selectedTitles.length) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetRoles: selectedTitles }),
        });
      }
      if (liInput.trim()) await saveLinkedIn(liInput);
      setStepStatus("profile", "done");

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

      if (saveJob && analysisSnapshot) {
        setStepStatus("job", "active");
        const url = jobUrl.trim();
        const company = analysisSnapshot.company ?? "Unknown Company";
        const role = analysisSnapshot.role ?? "Unknown Role";
        const notes = JSON.stringify({
          location: analysisSnapshot.location,
          salary: analysisSnapshot.salary,
          description: analysisSnapshot.description,
          requirements: analysisSnapshot.requirements,
        });
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company, role, url, notes }),
        });
        const job = await res.json();
        if (res.ok && job.id) {
          savedJobId = job.id;
          if (matchSnapshot?.score != null) {
            await fetch(`/api/jobs/${job.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fitAnalysis: JSON.stringify({ score: matchSnapshot.score }) }),
            }).catch(() => {});
          }
          setStepStatus("job", "done");
        } else {
          setStepStatus("job", "skipped");
        }
      } else {
        setStepStatus("job", "skipped");
      }

      const hasMatchJob = saveJob && !!analysisSnapshot?.description && !!primaryAssetId;
      if (hasMatchJob) {
        setStepStatus("match", "active");
        await new Promise((r) => setTimeout(r, 400));
        setStepStatus("match", "done");
      } else {
        setStepStatus("match", "skipped");
      }

      writeOnboardingFinishPayload({
        primaryAssetId,
        jobDescription: saveJob ? analysisSnapshot?.description ?? null : null,
        jobTitle: saveJob ? analysisSnapshot?.role ?? null : null,
        company: saveJob ? analysisSnapshot?.company ?? null : null,
        jobId: savedJobId,
        autoRunMatch: hasMatchJob,
      });

      router.push("/profile/assets?open=primary");
    } catch {
      writeOnboardingFinishPayload({ primaryAssetId, autoRunMatch: false });
      router.push("/profile/assets?open=primary");
    }
  }, [
    aboutYouFields,
    goTo,
    jobAnalysis,
    jobMatch,
    jobUrl,
    liInput,
    selectedTitles,
    setStepStatus,
    router,
  ]);

  const finishSetup = useCallback(() => runFinishSetup(false), [runFinishSetup]);
  const finishSetupWithJob = useCallback(() => runFinishSetup(true), [runFinishSetup]);

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
            <ScreenAboutYouSearch
              careerMotivation={careerMotivation}
              jobTimeline={jobTimeline}
              onCareerMotivationChange={setCareerMotivation}
              onJobTimelineChange={setJobTimeline}
              onContinue={goToPreferences}
              onSkip={skipAboutYouToTransition}
            />
          )}
          {screen === 4 && (
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
              onContinue={goToTransition}
              onSkip={goToTransition}
            />
          )}
          {screen === 5 && (
            <ScreenTransition
              targetRoles={selectedTitles}
              jobUrl={jobUrl}
              onJobUrlChange={(v) => {
                setJobUrl(v);
                if (jobAnalysis) setJobAnalysis(null);
                if (jobMatch) setJobMatch(null);
                if (jobError) setJobError(null);
                if (jobMatchError) setJobMatchError(null);
              }}
              onAnalyze={analyzeFirstJob}
              onFinish={finishSetup}
              onFinishWithJob={finishSetupWithJob}
              onSkip={finishSetup}
              loading={jobLoading}
              loadingPhase={jobLoadingPhase}
              error={jobError}
              matchError={jobMatchError}
              analysis={jobAnalysis}
              match={jobMatch}
            />
          )}
          {screen === 6 && <ScreenSetup steps={setupSteps} />}
        </div>
      </div>
      {process.env.NODE_ENV === "development" && screen !== 6 && <DemoNextButton onClick={demoAdvance} />}
    </div>
  );
}
