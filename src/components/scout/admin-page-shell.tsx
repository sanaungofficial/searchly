"use client";

import type { ReactNode } from "react";
import { WorkspaceContent, WorkspaceScroll } from "./workspace-content";
import { surface } from "@/lib/typography";

/** Admin pages — same centered column + scroll as the rest of the workspace. */
export function AdminPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
      }}
    >
      <WorkspaceScroll>
        <WorkspaceContent>{children}</WorkspaceContent>
      </WorkspaceScroll>
    </div>
  );
}
