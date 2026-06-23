"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ScoutHeader,
  ScreenWelcome,
  ScreenReadBack,
  ScreenTargetRoles,
  ScreenAboutYou,
  ScreenTransition,
  DemoNextButton,
  ROLE_BUCKETS,
  type Screen,
  type ReadBackData,
} from "@/components/scout/screens";

function saveLinkedIn(url: string) {
  if (!url.trim()) return;
  fetch("/api/profile", {
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
        setResumeUploaded(true);
        if (liInput.trim()) saveLinkedIn(liInput);
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
  const onLIChange = (e: React.ChangeEvent<HTMLInputElement>) => setLiInput(e.target.value);

  const onWelcomeContinue = useCallback(() => {
    if (!resumeUploaded) return;
    if (liInput.trim()) saveLinkedIn(liInput);
    goTo(1);
  }, [liInput, resumeUploaded, goTo]);

  const onLinkedInOnly = useCallback(() => {
    saveLinkedIn(liInput);
    goTo(2);
  }, [liInput, goTo]);

  const onLIKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (resumeUploaded) onWelcomeContinue();
    else if (liInput.trim()) onLinkedInOnly();
  }, [resumeUploaded, liInput, onWelcomeContinue, onLinkedInOnly]);

  const onSkipProfile = useCallback(() => goTo(2), [goTo]);

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

  const goToTransition = useCallback(() => {
    saveAboutYou({ careerMotivation, jobTimeline, currentSalary, targetSalary, priorities, attribution });
    goTo(4);
  }, [careerMotivation, jobTimeline, currentSalary, targetSalary, priorities, attribution, goTo]);

  const onEnterWorkspace = useCallback(() => {
    router.push("/opportunities?addJob=1");
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
            <ScreenAboutYou
              careerMotivation={careerMotivation}
              jobTimeline={jobTimeline}
              currentSalary={currentSalary}
              targetSalary={targetSalary}
              priorities={priorities}
              attribution={attribution}
              onCareerMotivationChange={setCareerMotivation}
              onJobTimelineChange={setJobTimeline}
              onCurrentSalaryChange={setCurrentSalary}
              onTargetSalaryChange={setTargetSalary}
              onTogglePriority={onTogglePriority}
              onAttributionChange={setAttribution}
              onContinue={goToTransition}
              onSkip={goToTransition}
            />
          )}
          {screen === 4 && (
            <ScreenTransition
              targetRoles={selectedTitles}
              onEnterWorkspace={onEnterWorkspace}
              onReviewProfile={onReviewProfile}
            />
          )}
        </div>
      </div>
      {process.env.NODE_ENV === "development" && <DemoNextButton onClick={demoAdvance} />}
    </div>
  );
}
