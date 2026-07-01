import { Suspense } from "react";
import { WorkspaceResumePage } from "@/components/scout/workspace-resume-page";

export default function ResumePage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceResumePage />
    </Suspense>
  );
}
