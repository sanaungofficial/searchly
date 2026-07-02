import { OrgClientDetailPanel } from "@/components/org/org-client-detail-panel";
import { requireOrgMember } from "@/lib/org-auth";
import { redirect } from "next/navigation";

export default async function OrgClientPage({
  params,
}: {
  params: Promise<{ orgId: string; clientUserId: string }>;
}) {
  const { orgId, clientUserId } = await params;
  const membership = await requireOrgMember(orgId);
  if (!membership) redirect("/dashboard");

  return <OrgClientDetailPanel orgId={orgId} clientUserId={clientUserId} />;
}
