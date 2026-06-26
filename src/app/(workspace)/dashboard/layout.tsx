"use client";

import { ExpertWorkspaceShell } from "@/components/scout/expert-workspace-shell";
import { isExpertPortalPath } from "@/lib/staff-portal";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isExpertPortalPath(pathname)) {
    return <ExpertWorkspaceShell>{children}</ExpertWorkspaceShell>;
  }
  return children;
}
