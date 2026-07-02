import { requireOrgMember } from "@/lib/org-auth";
import { redirect } from "next/navigation";

export default async function OrgRootPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const membership = await requireOrgMember(orgId);
  if (!membership) redirect("/dashboard");

  redirect(`/org/${orgId}/dashboard`);
}
