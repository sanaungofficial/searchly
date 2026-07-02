import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import { listOrgPotentialConnections } from "@/lib/org-network-match";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  const { orgId, userId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await listOrgPotentialConnections(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ targets: result.targets });
}
