import { OrgContactsPanel } from "@/components/org/org-contacts-panel";
import { requireOrgMember } from "@/lib/org-auth";
import { redirect } from "next/navigation";

export default async function OrgContactsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const membership = await requireOrgMember(orgId);
  if (!membership) redirect("/dashboard");

  return <OrgContactsPanel orgId={orgId} />;
}
