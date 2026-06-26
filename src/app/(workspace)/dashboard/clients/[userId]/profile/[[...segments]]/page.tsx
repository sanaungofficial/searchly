import { Suspense } from "react";
import { AdminClientProfileRedirect } from "@/components/admin/admin-client-profile-redirect";

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
  const { userId, segments } = await params;
  const profileSuffix =
    segments?.length && segments.length > 0 ? `/${segments.join("/")}` : "";
  return <AdminClientProfileRedirect userId={userId} profileSuffix={profileSuffix} />;
}
