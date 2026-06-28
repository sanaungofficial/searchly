"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bruddleHeadingStyle } from "@/lib/typography";
import { createClient } from "@/utils/supabase/client";
import { friendlyAuthMessage } from "@/lib/auth-errors";

type AuthMode = "login" | "signup";

const MIN_PASSWORD_LENGTH = 8;

function friendlyAuthError(message: string, mode: AuthMode) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (lower.includes("password") && lower.includes("least")) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  return friendlyAuthMessage(message) || (mode === "login" ? "Could not sign in." : "Could not create account.");
}

async function completeSession(router: ReturnType<typeof useRouter>) {
  const res = await fetch("/api/auth/sync-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Could not finish signing in.");
  }
  router.push(data.redirectTo ?? "/dashboard");
}

export function AuthCredentialsForm({ mode }: { mode: AuthMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const isSignup = mode === "signup";

  const handleGoogle = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) setError(oauthError.message);
  };

  const handleLinkedIn = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) setError(oauthError.message);
  };

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?type=email`,
            data: { name: trimmedEmail.split("@")[0] },
          },
        });

        if (signUpError) {
          setError(friendlyAuthError(signUpError.message, mode));
          return;
        }

        if (data.session) {
          await completeSession(router);
          return;
        }

        setConfirmSent(true);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(friendlyAuthError(signInError.message, mode));
        return;
      }

      await completeSession(router);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            ...bruddleHeadingStyle("h4"),
            color: "#1C3A2F",
            marginBottom: 12,
          }}
        >
          Check your inbox.
        </h2>
        <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
          We sent a link to <strong>{email.trim()}</strong>. Click it to finish setup, then sign in.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleGoogle}
        className="auth-btn"
        style={{
          background: "#FFFFFF",
          color: "#1C3A2F",
          border: "var(--scout-border)",
          marginBottom: 12,
          transition: "background 0.15s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = "#F9F6F1")}
        onMouseOut={(e) => (e.currentTarget.style.background = "#FFFFFF")}
      >
        <GoogleIcon />
        {isSignup ? "Sign up with Google" : "Continue with Google"}
      </button>

      <button
        type="button"
        onClick={handleLinkedIn}
        className="auth-btn"
        style={{
          background: "#0A66C2",
          color: "#FFFFFF",
          border: "none",
          marginBottom: 20,
          transition: "opacity 0.15s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <LinkedInIcon />
        {isSignup ? "Sign up with LinkedIn" : "Continue with LinkedIn"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: "#E5DDD0" }} />
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "#E5DDD0" }} />
      </div>

      <form onSubmit={handleEmailPassword}>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="auth-input"
          onFocus={(e) => (e.currentTarget.style.borderColor = "#1C3A2F")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#E5DDD0")}
        />
        <input
          type="password"
          placeholder={isSignup ? "Password (8+ characters)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete={isSignup ? "new-password" : "current-password"}
          className="auth-input"
          onFocus={(e) => (e.currentTarget.style.borderColor = "#1C3A2F")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#E5DDD0")}
        />
        <button
          type="submit"
          disabled={loading}
          className="auth-btn"
          style={{
            background: loading ? "rgba(26,58,47,0.35)" : "#1A3A2F",
            color: "#E8D5A3",
            border: "var(--scout-border)",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "opacity 0.15s",
          }}
          onMouseOver={(e) => {
            if (!loading) e.currentTarget.style.opacity = "0.85";
          }}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          {loading ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      {error && (
        <p style={{ fontSize: 13, color: "#DC2626", marginTop: 12, textAlign: "center" }}>
          {error}
        </p>
      )}

      {isSignup && (
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 20, textAlign: "center", lineHeight: 1.5 }}>
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      )}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}
