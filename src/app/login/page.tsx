"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCredentialsForm } from "@/components/auth/auth-credentials-form";
import { KimchiBySecondLadder } from "@/components/scout/scout-box";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "account_sync_failed") {
      setError("We signed you in but could not finish setting up your account. Please try again.");
    } else if (err === "no_code") {
      setError("Sign-in link expired or was invalid. Please try again.");
    } else if (err.toLowerCase().includes("code verifier")) {
      setError(
        "This link must be opened in the same browser where you signed up. Try signing in with your email and password instead."
      );
    } else if (err) {
      setError(decodeURIComponent(err));
    }
  }, [searchParams]);

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
          Welcome back.
        </h2>
        <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 32, lineHeight: 1.5 }}>
          Sign in to your Kimchi workspace.
        </p>

        <AuthCredentialsForm mode="login" />

        {error && (
          <p style={{ fontSize: 13, color: "#DC2626", marginTop: 12, textAlign: "center" }}>
            {error}
          </p>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
