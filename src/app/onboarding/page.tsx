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
  DemoNextButton,
  ROLE_BUCKETS,
  type Screen,
  type ReadBackData,
  type TransitionJobAnalysis,
  type TransitionJobMatch,
} from "@/components/scout/screens";

async function saveLinkedIn(url: string) {
  if (!url.trim()) return;
  await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkedinUrl: url.trim() }),
  }).catch(() => {});
}

function saveAboutYou(fields: {
  careerMotivation: string;
  jobTimeline: string;
  currentSalary: string;
  targetSalary: string;
  priorities: string[];
  attribution: string;
}) {
  fetch("/api/profile", {
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
  }).catch(() => {});
}

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
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
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

  const goTo = useCallback((n: Screen) => setScreen(n), []);

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
        const data = await res.json();
        const linkedInFromResume =
          typeof data.parsedData?.linkedinUrl === "string"
            ? data.parsedData.linkedinUrl.trim()
            : "";
        if (linkedInFromResume) {
          setLiInput(linkedInFromResume);
        }
        setResumeUploaded(true);
      } else {
        setResumeError(true);
        setResumeFilename(null);
      }
    } catch {
      setResumeError(true);
      setResumeFilename(null);
    }
  }, [liInput]);

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
  const onLIChange = (e: React.ChangeEvent<HTMLInputElement>) => setLiInput(e.target.value);

  const onWelcomeContinue = useCallback(async () => {
    if (!resumeUploaded) return;
    if (liInput.trim()) await saveLinkedIn(liInput);
    goTo(1);
  }, [liInput, resumeUploaded, goTo]);

  const onLinkedInOnly = useCallback(async () => {
    await saveLinkedIn(liInput);
    goTo(2);
  }, [liInput, goTo]);

  const onLIKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (resumeUploaded) onWelcomeContinue();
    else if (liInput.trim()) onLinkedInOnly();
  }, [resumeUploaded, liInput, onWelcomeContinue, onLinkedInOnly]);

  const onSkipProfile = useCallback(async () => {
    if (liInput.trim()) await saveLinkedIn(liInput);
    goTo(2);
  }, [liInput, goTo]);

  const onToggleBucket = useCallback((id: string) => {
    const newBuckets = selectedBuckets.includes(id)
      ? selectedBuckets.filter((b) => b !== id)
      : [...selectedBuckets, id];
    setSelectedBuckets(newBuckets);
    const validTitles = new Set(
      ROLE_BUCKETS.filter((b) => newBuckets.includes(b.id)).flatMap((b) => b.titles)
    );
    setSelectedTitles((prev) => prev.filter((t) => validTitles.has(t)));
  }, [selectedBuckets]);

  const onToggleTitle = useCallback((title: string) => {
    setSelectedTitles((prev) => {
      if (prev.includes(title)) return prev.filter((t) => t !== title);
      if (prev.length >= 3) return prev;
      return [...prev, title];
    });
  }, []);

  const onReadBackConfirm = useCallback((_data: ReadBackData | null) => {
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
    saveAboutYou({ careerMotivation, jobTimeline, currentSalary, targetSalary, priorities, attribution });
    goTo(5);
  }, [careerMotivation, jobTimeline, currentSalary, targetSalary, priorities, attribution, goTo]);

  const skipAboutYouToTransition = useCallback(() => {
    saveAboutYou({ careerMotivation, jobTimeline, currentSalary, targetSalary, priorities, attribution });
    goTo(5);
  }, [careerMotivation, jobTimeline, currentSalary, targetSalary, priorities, attribution, goTo]);

  const analyzeFirstJob = useCallback(async () => {
    const url = jobUrl.trim();
    if (!url) return;
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
          setJobMatchError("Upload a resume to see your match score — you can still add this job to your pipeline.");
        } else if (matchRes.status === 503) {
          setJobMatchError("Fit scoring isn't available here yet — add the job and we'll score it in your workspace.");
        } else {
          setJobMatchError(matchData.error ?? "Couldn't score your fit right now. You can still add this job.");
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

  const saveFirstJob = useCallback(
    async (tool: "resume" | "cover" | null) => {
      if (!jobAnalysis) return;
      const url = jobUrl.trim();
      const company = jobAnalysis.company ?? "Unknown Company";
      const role = jobAnalysis.role ?? "Unknown Role";
      const notes = JSON.stringify({
        location: jobAnalysis.location,
        salary: jobAnalysis.salary,
        description: jobAnalysis.description,
        requirements: jobAnalysis.requirements,
      });
      setJobLoading(true);
      setJobError(null);
      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company, role, url, notes }),
        });
        const job = await res.json();
        if (!res.ok) {
          setJobError(job.error ?? "Could not save this job.");
          return;
        }

        if (jobMatch && job.id) {
          await fetch(`/api/jobs/${job.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fitAnalysis: JSON.stringify({ score: jobMatch.score }) }),
          }).catch(() => {});
        }

        const params = new URLSearchParams({ job: job.id });
        if (tool) params.set("tool", tool);
        router.push(`/opportunities/pipeline?${params.toString()}`);
      } catch {
        setJobError("Network error — please try again.");
      } finally {
        setJobLoading(false);
      }
    },
    [jobAnalysis, jobUrl, jobMatch, router]
  );

  const skipToWorkspace = useCallback(() => {
    router.push("/opportunities/pipeline");
  }, [router]);

  const onReviewProfile = useCallback(() => {
    saveAboutYou({ careerMotivation, jobTimeline, currentSalary, targetSalary, priorities, attribution });
    router.push("/profile");
  }, [careerMotivation, jobTimeline, currentSalary, targetSalary, priorities, attribution, router]);

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
        <ScoutHeader screen={screen} />
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
              selectedBuckets={selectedBuckets}
              selectedTitles={selectedTitles}
              onToggleBucket={onToggleBucket}
              onToggleTitle={onToggleTitle}
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
              onTailorResume={() => saveFirstJob("resume")}
              onWriteCoverLetter={() => saveFirstJob("cover")}
              onAddJob={() => saveFirstJob(null)}
              onSkip={skipToWorkspace}
              onReviewProfile={onReviewProfile}
              loading={jobLoading}
              loadingPhase={jobLoadingPhase}
              error={jobError}
              matchError={jobMatchError}
              analysis={jobAnalysis}
              match={jobMatch}
            />
          )}
        </div>
      </div>
      {process.env.NODE_ENV === "development" && <DemoNextButton onClick={demoAdvance} />}
    </div>
  );
}
