import { OrgClientSettingsPanel } from "@/components/org/org-client-settings-panel";
import { requireOrgMember } from "@/lib/org-auth";
import { redirect } from "next/navigation";

export default async function OrgClientsSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const membership = await requireOrgMember(orgId, { adminOnly: true });
  if (!membership) redirect("/dashboard");

  return <OrgClientSettingsPanel orgId={orgId} />;
}
