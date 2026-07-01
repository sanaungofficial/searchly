"use client";

import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { readWorkspaceStackTopPx, WORKSPACE_LAYOUT_SYNC_EVENT } from "@/lib/workspace-layout";
import { TOP_NAV_HEIGHT, TOP_NAV_HEIGHT_MOBILE } from "@/components/scout/workspace-top-nav";

/** Pixels from viewport top to the bottom of the fixed workspace nav (includes banner offset). */
export function useWorkspaceStackTop(): number {
  const isMobile = useIsMobile();
  const fallback = isMobile ? TOP_NAV_HEIGHT_MOBILE : TOP_NAV_HEIGHT;
  const [topPx, setTopPx] = useState(fallback);

  useEffect(() => {
    const sync = () => setTopPx(readWorkspaceStackTopPx(fallback));
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener(WORKSPACE_LAYOUT_SYNC_EVENT, sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener(WORKSPACE_LAYOUT_SYNC_EVENT, sync);
    };
  }, [fallback]);

  return topPx;
}
