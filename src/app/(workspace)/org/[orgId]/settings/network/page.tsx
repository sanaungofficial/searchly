import { OrgNetworkSettingsPanel } from "@/components/org/org-network-settings-panel";
import { requireOrgMember } from "@/lib/org-auth";
import { redirect } from "next/navigation";

export default async function OrgNetworkSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const membership = await requireOrgMember(orgId);
  if (!membership) redirect("/dashboard");

  return <OrgNetworkSettingsPanel orgId={orgId} isOrgAdmin={membership.role === "ADMIN"} />;
}
