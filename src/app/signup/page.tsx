"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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

  const handleLinkedIn = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F2EDE3",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 48, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
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

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFFDF9",
          border: "1px solid #E5DDD0",
          borderRadius: 16,
          padding: "40px 36px",
        }}
      >
        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✉️</div>
            <h2
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontSize: 24,
                fontWeight: 600,
                color: "#1C3A2F",
                marginBottom: 12,
              }}
            >
              Check your inbox
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
              We sent a magic link to <strong>{email}</strong>. Click it to create your account — no password needed.
            </p>
          </div>
        ) : (
          <>
            <h2
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontSize: 26,
                fontWeight: 600,
                color: "#1C3A2F",
                marginBottom: 8,
                fontStyle: "italic",
              }}
            >
              Create your account.
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 32, lineHeight: 1.5 }}>
              Your AI-powered job search workspace.
            </p>

            {/* LinkedIn */}
            <button
              onClick={handleLinkedIn}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "12px 20px",
                background: "#0A66C2",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: 20,
                fontFamily: "inherit",
                transition: "opacity 0.15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <LinkedInIcon />
              Sign up with LinkedIn
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: "#E5DDD0" }} />
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#E5DDD0" }} />
            </div>

            {/* Magic link */}
            <form onSubmit={handleMagicLink}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #E5DDD0",
                  borderRadius: 10,
                  fontSize: 14,
                  color: "#1C3A2F",
                  background: "#F9F6F1",
                  marginBottom: 12,
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#1C3A2F")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#E5DDD0")}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  background: loading ? "#9CA3AF" : "#C9A84C",
                  color: "#1C3A2F",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
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

            {/* Terms */}
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 20, textAlign: "center", lineHeight: 1.5 }}>
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>
          </>
        )}
      </div>

      {/* Switch to login */}
      <p style={{ marginTop: 24, fontSize: 13, color: "#6B7280" }}>
        Already have an account?{" "}
        <button
          onClick={() => router.push("/login")}
          style={{ background: "none", border: "none", color: "#1C3A2F", fontWeight: 600, cursor: "pointer", fontSize: 13, padding: 0, fontFamily: "inherit" }}
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

