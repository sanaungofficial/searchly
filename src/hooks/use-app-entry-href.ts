"use client";

import { useEffect, useState } from "react";
import { hasValidClientSession } from "@/lib/client-auth-session";

/** Log In / Sign Up targets — workspace home only when the server accepts the session. */
export function useAppEntryHref(fallback: "/login" | "/signup"): "/login" | "/signup" | "/dashboard" {
  const [href, setHref] = useState<"/login" | "/signup" | "/dashboard">(fallback);

  useEffect(() => {
    hasValidClientSession().then((valid) => {
      if (valid) setHref("/dashboard");
    });
  }, []);

  return href;
}
