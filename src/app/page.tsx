"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ScoutHeader,
  ScreenWelcome,
  ScreenReadBack,
  ScreenTransition,
  DemoNextButton,
  type Screen,
  type ReadBackData,
} from "@/components/scout/screens";
import { ScoutWorkspace } from "@/components/scout/workspace";

type View = "onboarding" | "workspace";

interface CurrentUser {
  name: string | null;
  email: string;
  avatarUrl: string | null;
  headline?: string | null;
}

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>("onboarding");
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("USER");

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

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

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
  }, []);

  const goTo = useCallback((n: Screen) => setScreen(n), []);

  const processFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    setResumeFilename(file.name);
    setResumeUploaded(false);
    window.setTimeout(() => setResumeUploaded(true), 1300);
  }, []);

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

  const onLIChange = (e: React.ChangeEvent<HTMLInputElement>) => setLiInput(e.target.value);

  const onWelcomeContinue = useCallback(() => {
    if (liInput.trim()) {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: liInput.trim() }),
      }).catch(() => {});
    }
    goTo(resumeUploaded ? 1 : 2);
  }, [liInput, resumeUploaded, goTo]);

  const onLIKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (resumeUploaded || liInput.trim())) onWelcomeContinue();
  }, [resumeUploaded, liInput, onWelcomeContinue]);

  const handleReadbackConfirm = useCallback((data: ReadBackData | null) => {
    if (data?.targetRoles?.length) {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRoles: data.targetRoles.map((r) => r.role) }),
      }).catch(() => {});
    }
    goTo(2);
  }, [goTo]);

  const demoAdvance = () => {
    if (screen === 0) {
      setResumeFilename("Sarah_Chen_Resume.pdf");
      window.setTimeout(() => setResumeUploaded(true), 1300);
    } else if (screen === 1) {
      goTo(2);
    }
  };

  if (!authChecked) {
    return <div style={{ height: "100vh", background: "#F2EDE3" }} />;
  }

  if (view === "workspace") {
    return (
      <Suspense>
        <ScoutWorkspace onBackToOnboarding={backToOnboarding} onSignOut={handleSignOut} user={currentUser ?? undefined} isAdmin={isAdmin} userRole={userRole} />
      </Suspense>
    );
  }

  return (
    <div style={{ background: "#F2EDE3" }}>
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
        <ScoutHeader screen={screen} onScoutClick={enterWorkspace} />

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
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onFileClick={onFileClick}
              onFileChange={onFileChange}
            />
          )}
          {screen === 1 && (
            <ScreenReadBack
              onConfirm={handleReadbackConfirm}
              onRefine={() => goTo(0)}
            />
          )}
          {screen === 2 && <ScreenTransition onEnterWorkspace={enterWorkspace} />}

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
