"use client";

import { WorkspaceCoach } from "@/components/scout/workspace-coach";
import { useWorkspace } from "@/contexts/workspace-context";

export default function ClientsPage() {
  const { userRole } = useWorkspace();
  const isStaff = userRole === "COACH" || userRole === "RECRUITER" || userRole === "ADMIN";
  if (!isStaff) return null;
  return <WorkspaceCoach />;
}
