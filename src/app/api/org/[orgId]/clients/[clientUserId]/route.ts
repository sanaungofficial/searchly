import { NextRequest, NextResponse } from "next/server";
import { getOrgClientDetail } from "@/lib/org-dashboard";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ orgId: string; clientUserId: string }> },
) {
  const { orgId, clientUserId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const detail = await getOrgClientDetail(orgId, clientUserId);
  if (!detail) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  return NextResponse.json({
    ...detail,
    role: auth.membership?.role ?? "ADMIN",
    isOrgAdmin: auth.membership?.role === "ADMIN" || auth.membership === null,
  });
}
