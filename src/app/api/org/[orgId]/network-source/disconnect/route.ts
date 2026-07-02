import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import {
  disconnectOrgNetworkSource,
  serializeOrgNetworkSource,
} from "@/lib/org-network-source";
import { prisma } from "@/lib/prisma";

export async function POST(_: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const membership = auth.membership
    ?? await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: auth.user.id } },
    });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await disconnectOrgNetworkSource(membership.id);
  return NextResponse.json({ source: serializeOrgNetworkSource(updated) });
}
