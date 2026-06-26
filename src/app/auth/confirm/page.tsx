"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { friendlyAuthMessage } from "@/lib/auth-errors";
import type { EmailOtpType } from "@supabase/supabase-js";

function AuthConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      const supabase = createClient();
      const next = searchParams.get("next") ?? "/";
      let authError: { message: string } | null = null;

      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const code = searchParams.get("code");

      if (code) {
        const qs = searchParams.toString();
        window.location.replace(`/auth/callback${qs ? `?${qs}` : ""}`);
        return;
      }

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as EmailOtpType,
        });
        authError = error;
      } else {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          authError = error;
        } else {
          authError = { message: "Sign-in link expired or invalid. Please try again." };
        }
      }

      if (authError) {
        if (!cancelled) {
          router.replace(
            `/login?error=${encodeURIComponent(friendlyAuthMessage(authError.message))}`
          );
        }
        return;
      }

      const res = await fetch("/api/auth/sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (!cancelled) {
          router.replace(
            `/login?error=${encodeURIComponent(data.error ?? "Could not finish signing in.")}`
          );
        }
        return;
      }

      if (!cancelled) {
        router.replace(data.redirectTo ?? "/dashboard");
      }
    }

    finishSignIn().catch(() => {
      if (!cancelled) {
        setMessage("Something went wrong.");
        router.replace("/login?error=Sign-in%20failed.%20Please%20try%20again.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F7F5F2",
        fontFamily: "var(--font-ui)",
        color: "#1C3A2F",
      }}
    >
      <p style={{ fontSize: 15 }}>{message}</p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <AuthConfirmContent />
    </Suspense>
  );
}
