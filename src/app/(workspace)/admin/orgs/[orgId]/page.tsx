import { AdminOrgDetailPanel } from "@/components/admin/admin-org-detail-panel";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <AdminOrgDetailPanel orgId={orgId} />;
}
