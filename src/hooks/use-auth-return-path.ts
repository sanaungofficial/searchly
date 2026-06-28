"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { buildAuthUrl, currentPathWithSearch } from "@/lib/auth-return-url";

export function useCurrentReturnPath(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return currentPathWithSearch(pathname, searchParams.toString());
}

export function useRequireAuthRedirect() {
  const returnPath = useCurrentReturnPath();
  return useCallback(
    (mode: "login" | "signup" = "login") => {
      window.location.href = buildAuthUrl(mode, returnPath);
    },
    [returnPath],
  );
}
