"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { resolvePostAuthRedirect } from "@/components/auth/post-auth-redirect";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error") ?? params.get("error_code");
    if (err) {
      const code = params.get("error_code") ?? "";
      const desc = params.get("error_description") ?? err;
      window.location.replace(`/login?error=${encodeURIComponent(code || desc)}`);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const destination = await resolvePostAuthRedirect();
        router.replace(destination);
      } catch {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  return <div style={{ height: "100vh", background: "var(--scout-page)" }} />;
}
