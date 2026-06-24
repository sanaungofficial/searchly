"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError(decodeURIComponent(err));
  }, [searchParams]);

  const supabase = createClient();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSubmitted(true);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  };

  const handleLinkedIn = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="auth-page">
      <div className="auth-page__logo">
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 500,
            color: "#1C3A2F",
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          Kimchi
        </div>
        <div style={{ fontSize: 14, color: "#6B7280", letterSpacing: "0.06em" }}>
          by Second Ladder
        </div>
      </div>

      <div className="auth-card">
        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✉️</div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 600,
                color: "#1C3A2F",
                marginBottom: 12,
              }}
            >
              Check your inbox
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
              We sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.
            </p>
          </div>
        ) : (
          <>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 600,
                color: "#1C3A2F",
                marginBottom: 8,
                fontStyle: "italic",
              }}
            >
              Welcome back.
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 32, lineHeight: 1.5 }}>
              Sign in to your Kimchi workspace.
            </p>

            <button
              type="button"
              onClick={handleGoogle}
              className="auth-btn"
              style={{
                background: "#FFFFFF",
                color: "#1C3A2F",
                border: "1px solid #E5DDD0",
                marginBottom: 12,
                transition: "background 0.15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#F9F6F1")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#FFFFFF")}
            >
              <GoogleIcon />
              Continue with Google
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
              Continue with LinkedIn
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: "#E5DDD0" }} />
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#E5DDD0" }} />
            </div>

            <form onSubmit={handleMagicLink}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                  color: loading ? "#E8D5A3" : "#E8D5A3",
                  border: "1px solid rgba(17,17,17,0.22)",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "opacity 0.15s",
                }}
                onMouseOver={(e) => { if (!loading) e.currentTarget.style.opacity = "0.85"; }}
                onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>

            {error && (
              <p style={{ fontSize: 13, color: "#DC2626", marginTop: 12, textAlign: "center" }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>

      <p className="auth-footer-link">
        Don&apos;t have an account?{" "}
        <button type="button" onClick={() => router.push("/signup")}>
          Sign up
        </button>
      </p>
    </div>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
