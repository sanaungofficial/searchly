import { Suspense } from "react";
import { WorkspaceProfile } from "@/components/scout/workspace-profile";

type Props = {
  params: Promise<{ userId: string; segments?: string[] }>;
};

export default function AdminClientProfilePage({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <AdminClientProfilePageInner params={params} />
    </Suspense>
  );
}

async function AdminClientProfilePageInner({ params }: Props) {
  const { userId } = await params;
  return <WorkspaceProfile key={userId} adminClientUserId={userId} />;
}
