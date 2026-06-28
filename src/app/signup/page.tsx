"use client";

import { useRouter } from "next/navigation";
import { bruddleHeadingStyle } from "@/lib/typography";
import { AuthCredentialsForm } from "@/components/auth/auth-credentials-form";
import { AuthPageBenefits } from "@/components/auth/auth-page-benefits";
import { KimchiBySecondLadder } from "@/components/scout/scout-box";

export default function SignupPage() {
  const router = useRouter();

  return (
    <div className="auth-split-outer bruddle">
      {/* Left: form */}
      <div className="auth-split-form">
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
              ...bruddleHeadingStyle("h3"),
              color: "#1C3A2F",
              marginBottom: 8,
              fontStyle: "italic",
            }}
          >
            Create your account.
          </h2>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 32, lineHeight: 1.5 }}>
            Free to start — job matches, resume help, and career coaching in one place. Already have an account?{" "}
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

      {/* Right: benefits panel */}
      <div className="auth-benefits-panel">
        <AuthPageBenefits />
      </div>
    </div>
  );
}
