"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ScoutHeader,
  ScreenWelcome,
  ScreenTargetRoles,
  ScreenAboutYou,
  DemoNextButton,
  ROLE_BUCKETS,
  type Screen,
} from "@/components/scout/screens";

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

  const goTo = useCallback((n: Screen) => setScreen(n), []);

  const processFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setResumeFilename(file.name);
    setResumeUploaded(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/resume", { method: "POST", body: formData });
      setResumeUploaded(res.ok);
    } catch {
      setResumeUploaded(false);
    }
  }, []);

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
    if (liInput.trim()) {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: liInput.trim() }),
      }).catch(() => {});
    }
    goTo(1);
  }, [liInput, goTo]);

  const onLIKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (resumeUploaded || liInput.trim())) onWelcomeContinue();
  }, [resumeUploaded, liInput, onWelcomeContinue]);

  const onSkipProfile = useCallback(() => goTo(1), [goTo]);

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

  const onRolesContinue = useCallback(() => {
    if (selectedTitles.length) {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRoles: selectedTitles }),
      }).catch(() => {});
    }
    goTo(2);
  }, [selectedTitles, goTo]);

  const onTogglePriority = useCallback((p: string) => {
    setPriorities((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }, []);

  const onAboutYouContinue = useCallback(() => {
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        careerMotivation: careerMotivation || null,
        jobTimeline: jobTimeline || null,
        currentSalary: currentSalary || null,
        targetSalary: targetSalary || null,
        priorities,
        attribution: attribution || null,
      }),
    }).catch(() => {});
    router.push("/opportunities");
  }, [careerMotivation, jobTimeline, currentSalary, targetSalary, priorities, attribution, router]);

  const demoAdvance = () => {
    if (screen === 0) {
      setResumeFilename("Sarah_Chen_Resume.pdf");
      window.setTimeout(() => setResumeUploaded(true), 1300);
    } else if (screen === 1) {
      goTo(2);
    }
  };

  if (!authChecked) {
    return <div style={{ height: "100vh", background: "#F7F5F2" }} />;
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
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "0 40px 100px",
        }}
      >
        <ScoutHeader screen={screen} onScoutClick={() => router.push("/opportunities")} />
        <div style={{ width: "100%", maxWidth: 620, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 40, paddingBottom: 60 }}>
          {screen === 0 && (
            <ScreenWelcome
              resumeFilename={resumeFilename}
              resumeUploaded={resumeUploaded}
              isDragging={isDragging}
              liInput={liInput}
              onLIChange={onLIChange}
              onLIKey={onLIKey}
              onContinue={onWelcomeContinue}
              onSkip={onSkipProfile}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFileClick={onFileClick}
              onFileChange={onFileChange}
            />
          )}
          {screen === 1 && (
            <ScreenTargetRoles
              selectedBuckets={selectedBuckets}
              selectedTitles={selectedTitles}
              onToggleBucket={onToggleBucket}
              onToggleTitle={onToggleTitle}
              onContinue={onRolesContinue}
            />
          )}
          {screen === 2 && (
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
              onContinue={onAboutYouContinue}
            />
          )}
        </div>
      </div>
      {process.env.NODE_ENV === "development" && <DemoNextButton onClick={demoAdvance} />}
    </div>
  );
}
