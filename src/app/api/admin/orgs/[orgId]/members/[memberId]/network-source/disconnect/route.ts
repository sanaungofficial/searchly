import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import {
  disconnectOrgNetworkSource,
  getOrgMemberById,
  serializeOrgNetworkSource,
} from "@/lib/org-network-source";

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> },
) {
  const { orgId, memberId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const member = await getOrgMemberById(memberId, orgId);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const updated = await disconnectOrgNetworkSource(member.id);
  return NextResponse.json({ source: serializeOrgNetworkSource(updated) });
}
