"use client";

import { useRouter } from "next/navigation";
import { AuthCredentialsForm } from "@/components/auth/auth-credentials-form";
import { KimchiBySecondLadder } from "@/components/scout/scout-box";

export default function SignupPage() {
  const router = useRouter();

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
        <KimchiBySecondLadder fontSize={14} color="#6B7280" marginTop={0} />
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
          Your AI-powered job search workspace.
        </p>

        <AuthCredentialsForm mode="signup" />
      </div>

      <p className="auth-footer-link">
        Already have an account?{" "}
        <button type="button" onClick={() => router.push("/login")}>
          Sign in
        </button>
      </p>
    </div>
  );
}
