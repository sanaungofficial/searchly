"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  ScoutHeader,
  ScreenWelcome,
  ScreenLinkedIn,
  ScreenReadBack,
  ScreenTargetJobs,
  ScreenTransition,
  DemoNextButton,
  type Screen,
  type Job,
} from "@/components/scout/screens";
import { ScoutWorkspace } from "@/components/scout/workspace";

type View = "onboarding" | "workspace";

const JOB_MOCKS = [
  { company: "Stripe", role: "Senior PM" },
  { company: "Linear", role: "Product Lead" },
  { company: "Figma", role: "Design Systems PM" },
];

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const [view, setView] = useState<View>("onboarding");

  const [screen, setScreen] = useState<Screen>(0);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [liInput, setLiInput] = useState("");
  const [liSubmitting, setLISubmitting] = useState(false);

  const [jobInput, setJobInput] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);

  /* ── View toggle ── */
  const enterWorkspace = useCallback(() => setView("workspace"), []);
  const backToOnboarding = useCallback(() => {
    setView("onboarding");
    setScreen(0);
    setResumeFilename(null);
    setResumeUploaded(false);
    setLiInput("");
    setLISubmitting(false);
    setJobInput("");
    setJobs([]);
  }, []);

  /* ── Onboarding flow ── */
  const goTo = useCallback((n: Screen) => {
    setScreen(n);
    setLISubmitting(false);
  }, []);

  const processFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      setResumeFilename(file.name);
      setResumeUploaded(false);
      window.setTimeout(() => {
        setResumeUploaded(true);
        window.setTimeout(() => goTo(1), 700);
      }, 1300);
    },
    [goTo],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
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

  const submitLI = () => {
    if (!liInput.trim()) return;
    setLISubmitting(true);
    window.setTimeout(() => goTo(2), 2100);
  };
  const onLIChange = (e: React.ChangeEvent<HTMLInputElement>) => setLiInput(e.target.value);
  const onLIKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submitLI();
  };

  const addJob = () => {
    if (!jobInput.trim() || jobs.length >= 3) return;
    const m = JOB_MOCKS[jobs.length] || { company: "Company", role: "PM Role" };
    const id = Date.now() + jobs.length;
    const job: Job = {
      id,
      company: m.company,
      role: m.role,
      initials: m.company.slice(0, 2).toUpperCase(),
      state: "reading",
    };
    setJobs((prev) => [...prev, job]);
    setJobInput("");
    window.setTimeout(() => {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, state: "ready" } : j)));
    }, 1900);
  };
  const onJobChange = (e: React.ChangeEvent<HTMLInputElement>) => setJobInput(e.target.value);
  const onJobKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addJob();
  };

  const demoAdvance = () => {
    if (screen === 0) {
      setResumeFilename("Sarah_Chen_Resume.pdf");
      window.setTimeout(() => {
        setResumeUploaded(true);
        window.setTimeout(() => goTo(1), 700);
      }, 1300);
    } else if (screen === 1) {
      setLiInput("linkedin.com/in/sarahchen-pm");
      setLISubmitting(true);
      window.setTimeout(() => goTo(2), 2100);
    } else if (screen === 2) {
      goTo(3);
    } else if (screen === 3) {
      const allReady = jobs.length > 0 && jobs.every((j) => j.state === "ready");
      if (allReady) {
        goTo(4);
        return;
      }
      if (jobs.length < 3) {
        const now = Date.now();
        const newJobs: Job[] = JOB_MOCKS.map((m, i) => ({
          id: now + i,
          company: m.company,
          role: m.role,
          initials: m.company.slice(0, 2).toUpperCase(),
          state: "reading",
        }));
        setJobs(newJobs);
        newJobs.forEach((job, i) => {
          const jid = job.id;
          window.setTimeout(() => {
            setJobs((prev) => prev.map((j) => (j.id === jid ? { ...j, state: "ready" } : j)));
          }, 1500 + i * 650);
        });
      }
    }
  };

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, [supabase, router]);

  /* ── Workspace view ── */
  if (view === "workspace") {
    return <ScoutWorkspace onBackToOnboarding={backToOnboarding} onSignOut={signOut} />;
  }

  /* ── Onboarding view ── */
  return (
    <div style={{ background: "#F2EDE3" }}>
      {/* Hidden file input — used by Welcome screen via getElementById */}
      <input
        id="scout-file"
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {/* ── Interactive flow ── */}
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "0 40px 100px",
        }}
      >
        <ScoutHeader screen={screen} onScoutClick={enterWorkspace} />

        <div style={{ width: "100%", maxWidth: 620, paddingTop: 88, flex: 1 }}>
          {screen === 0 && (
            <ScreenWelcome
              resumeFilename={resumeFilename}
              resumeUploaded={resumeUploaded}
              isDragging={isDragging}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFileClick={onFileClick}
              onFileChange={onFileChange}
            />
          )}
          {screen === 1 && (
            <ScreenLinkedIn
              resumeFilename={resumeFilename}
              liInput={liInput}
              liSubmitting={liSubmitting}
              onLIChange={onLIChange}
              onLIKey={onLIKey}
              onLISubmit={submitLI}
            />
          )}
          {screen === 2 && <ScreenReadBack onConfirm={() => goTo(3)} />}
          {screen === 3 && (
            <ScreenTargetJobs
              jobInput={jobInput}
              jobs={jobs}
              onJobChange={onJobChange}
              onJobKey={onJobKey}
              onAddJob={addJob}
              onFinish={() => goTo(4)}
            />
          )}
          {screen === 4 && <ScreenTransition onEnterWorkspace={enterWorkspace} />}
        </div>
      </div>

      <DemoNextButton onClick={demoAdvance} />
    </div>
  );
}
