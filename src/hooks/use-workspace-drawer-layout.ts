"use client";

import type { CSSProperties } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceStackTop } from "@/hooks/use-workspace-stack-top";
import { backdropBelowNav } from "@/lib/z-layers";

/** Desktop gutter between drawer panel and viewport edge (px). Mobile panels are flush to stack top. */
export const WORKSPACE_DRAWER_INSET = 8;

export type WorkspaceDrawerLayoutOptions = {
  /** Desktop inset below nav; use 0 for full-height flush panels (e.g. filter drawer). Default 8. */
  inset?: number;
};

/**
 * Workspace drawer layout — panels sit BELOW the fixed top nav, never under/over it.
 * Uses --workspace-stack-top (nav height + impersonation banner).
 */
export function useWorkspaceDrawerLayout(options?: WorkspaceDrawerLayoutOptions) {
  const isMobile = useIsMobile();
  const stackTop = useWorkspaceStackTop();
  const inset = options?.inset ?? WORKSPACE_DRAWER_INSET;
  const panelTop = isMobile ? stackTop : stackTop + inset;
  const panelRight = isMobile ? 0 : inset;
  const panelBottom = isMobile ? 0 : inset;
  const panelLeft = isMobile ? 0 : undefined;

  const backdropStyle: CSSProperties = backdropBelowNav(stackTop);

  const panelStyle: CSSProperties = {
    position: "fixed",
    top: panelTop,
    right: panelRight,
    bottom: panelBottom,
    left: panelLeft,
  };

  return {
    stackTop,
    isMobile,
    inset,
    panelTop,
    panelRight,
    panelBottom,
    panelLeft,
    backdropStyle,
    panelStyle,
  };
}
