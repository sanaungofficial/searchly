"use client";

import type { ReactNode } from "react";
import { WorkspaceSubpageShell } from "./workspace-content";

/** Admin routes — Bruddle-scoped sub-page shell */
export function AdminPageShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceSubpageShell bruddle>
      {children}
    </WorkspaceSubpageShell>
  );
}
