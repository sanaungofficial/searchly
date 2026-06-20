"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          Searchly
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
              We sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.
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
              Welcome back.
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 32, lineHeight: 1.5 }}>
              Sign in to your Searchly workspace.
            </p>

            {/* Google */}
            <button
              onClick={handleGoogle}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "12px 20px",
                background: "#1C3A2F",
                color: "#F2EDE3",
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
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
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
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
