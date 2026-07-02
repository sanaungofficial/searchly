import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import {
  countPooledContributors,
  listOrgNetworkSourcesForOrg,
} from "@/lib/org-network-source";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const members = await listOrgNetworkSourcesForOrg(orgId);
  const stats = countPooledContributors(members);

  return NextResponse.json({
    org: { id: org.id, name: org.name },
    members,
    stats,
  });
}
