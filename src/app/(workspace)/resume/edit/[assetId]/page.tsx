import { Suspense } from "react";
import { WorkspaceResumePage } from "@/components/scout/workspace-resume-page";

export default async function ResumeEditPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  return (
    <Suspense fallback={null}>
      <WorkspaceResumePage editAssetId={assetId} />
    </Suspense>
  );
}
