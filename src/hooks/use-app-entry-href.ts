"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

/** Log In / Sign Up targets — workspace home when a session exists. */
export function useAppEntryHref(fallback: "/login" | "/signup"): "/login" | "/signup" | "/dashboard" {
  const [href, setHref] = useState<"/login" | "/signup" | "/dashboard">(fallback);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setHref("/dashboard");
    });
  }, []);

  return href;
}
