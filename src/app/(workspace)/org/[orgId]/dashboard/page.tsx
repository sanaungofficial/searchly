import { OrgDashboardPanel } from "@/components/org/org-dashboard-panel";
import { requireOrgMember } from "@/lib/org-auth";
import { redirect } from "next/navigation";

export default async function OrgDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const membership = await requireOrgMember(orgId);
  if (!membership) redirect("/dashboard");

  return <OrgDashboardPanel orgId={orgId} />;
}
