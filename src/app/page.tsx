"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
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

interface CurrentUser {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  headline?: string | null;
}

const JOB_MOCKS = [
  { company: "Stripe", role: "Senior PM" },
  { company: "Linear", role: "Product Lead" },
  { company: "Figma", role: "Design Systems PM" },
];

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>("onboarding");
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("USER");

  // Supabase redirects auth errors back to the root URL with ?error= params.
  // Detect and forward them to /login so the user sees a clear message.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error") ?? params.get("error_code");
    if (err) {
      const code = params.get("error_code") ?? "";
      const desc = params.get("error_description") ?? err;
      window.location.replace(
        `/login?error=${encodeURIComponent(code || desc)}`
      );
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAuthChecked(true); return; }
      let headline: string | null = null;
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          headline = data?.headline ?? null;
        }
      } catch {}
      try {
        const res = await fetch("/api/admin");
        setIsAdmin(res.ok);
      } catch {}
      try {
        const res = await fetch("/api/staff/role");
        if (res.ok) {
          const data = await res.json();
          setUserRole(data.role ?? "USER");
        }
      } catch {}
      setCurrentUser({
        name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null,
        email: user.email!,
        avatarUrl: user.user_metadata?.avatar_url ?? null,
        headline,
      });
      setView("workspace");
      setAuthChecked(true);
    });
  }, []);

  const [screen, setScreen] = useState<Screen>(0);
  const [resumeFilename, setResumeFilename] = useState<string | null>(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [liInput, setLiInput] = useState("");
  const [liSubmitting, setLISubmitting] = useState(false);

  const [jobInput, setJobInput] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);

  /* ── Auth ── */
  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  /* ── View toggle ── */
  const enterWorkspace = useCallback(() => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setView("workspace");
  }, [currentUser, router]);
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

  /* ── Auth loading gate — prevents onboarding flash for logged-in users ── */
  if (!authChecked) {
    return <div style={{ height: "100vh", background: "#F2EDE3" }} />;
  }

  /* ── Workspace view ── */
  if (view === "workspace") {
    return (
      <Suspense>
        <ScoutWorkspace onBackToOnboarding={backToOnboarding} onSignOut={handleSignOut} user={currentUser ?? undefined} isAdmin={isAdmin} userRole={userRole} />
      </Suspense>
    );
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

        <div style={{ width: "100%", maxWidth: 620, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 40, paddingBottom: 60 }}>
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
              onSkip={() => goTo(3)}
            />
          )}
          {screen === 2 && <ScreenReadBack onConfirm={() => goTo(3)} onRefine={() => goTo(1)} />}
          {screen === 3 && (
            <ScreenTargetJobs
              jobInput={jobInput}
              jobs={jobs}
              onJobChange={onJobChange}
              onJobKey={onJobKey}
              onAddJob={addJob}
              onFinish={() => goTo(4)}
              onSkip={() => goTo(4)}
            />
          )}
          {screen === 4 && <ScreenTransition onEnterWorkspace={enterWorkspace} />}

          {screen === 0 && (
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 13,
                fontWeight: 300,
                color: "#A09890",
                marginTop: 28,
              }}
            >
              Already have an account?{" "}
              <a
                href="/login"
                style={{
                  color: "#1A3A2F",
                  textDecoration: "underline",
                  fontWeight: 400,
                }}
              >
                Sign in
              </a>
            </p>
          )}
        </div>
      </div>

      {process.env.NODE_ENV === "development" && <DemoNextButton onClick={demoAdvance} />}
    </div>
  );
}
