import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import {
  getOrgNetworkSourceForUserInOrg,
  parseNetworkPoolVisibility,
  serializeOrgNetworkSource,
  updateOrgNetworkSourceVisibility,
} from "@/lib/org-network-source";
import { prisma } from "@/lib/prisma";
import { isNylasConfigured } from "@/lib/nylas";

export async function GET(_: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const source = await getOrgNetworkSourceForUserInOrg(orgId, auth.user.id);
  return NextResponse.json({
    source: source ? serializeOrgNetworkSource(source) : null,
    configured: isNylasConfigured(),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const membership = auth.membership
    ?? await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: auth.user.id } },
    });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const visibility = parseNetworkPoolVisibility(body.visibility);
  if (!visibility) {
    return NextResponse.json({ error: "visibility must be PRIVATE or POOLED" }, { status: 400 });
  }

  const updated = await updateOrgNetworkSourceVisibility(membership.id, visibility);
  return NextResponse.json({ source: serializeOrgNetworkSource(updated) });
}
