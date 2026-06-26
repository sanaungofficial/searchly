"use client";

import { ExpertWorkspaceShell } from "@/components/scout/expert-workspace-shell";

export default function ExpertLayout({ children }: { children: React.ReactNode }) {
  return <ExpertWorkspaceShell>{children}</ExpertWorkspaceShell>;
}
