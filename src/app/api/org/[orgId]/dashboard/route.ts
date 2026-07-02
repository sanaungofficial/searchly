import { NextRequest, NextResponse } from "next/server";
import { getOrgDashboardData } from "@/lib/org-dashboard";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await getOrgDashboardData(orgId);
  if (!data) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  return NextResponse.json({
    ...data,
    role: auth.membership?.role ?? "ADMIN",
    isOrgAdmin: auth.membership?.role === "ADMIN" || auth.membership === null,
  });
}
