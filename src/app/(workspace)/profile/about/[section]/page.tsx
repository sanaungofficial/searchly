import { Suspense } from "react";
import { WorkspaceProfile } from "@/components/scout/workspace-profile";

export default function ProfileAboutSectionPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceProfile />
    </Suspense>
  );
}
