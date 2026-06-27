"use client";

import { useRouter } from "next/navigation";
import { AuthCredentialsForm } from "@/components/auth/auth-credentials-form";
import { KimchiWordmark } from "@/components/scout/kimchi-logo";

export default function SignupPage() {
  const router = useRouter();

  return (
    <div className="auth-page">
      <div className="auth-page__logo">
        <KimchiWordmark markSize={36} titleSize={28} showTagline align="center" />
      </div>

      <div className="auth-card">
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
          Create your account.
        </h2>
        <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 32, lineHeight: 1.5 }}>
          Create your free account — resume help, saved jobs, and Scout in one place. Already have an account?{" "}
          <button
            type="button"
            onClick={() => router.push("/login")}
            style={{ background: "none", border: "none", padding: 0, color: "#1A3A2F", fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            Sign in
          </button>
          .
        </p>

        <AuthCredentialsForm mode="signup" />
      </div>

      <p className="auth-footer-link">
        Already have an account?{" "}
        <button type="button" onClick={() => router.push("/login")}>
          Sign in here
        </button>
      </p>
    </div>
  );
}
