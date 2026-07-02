import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import { listOrgConnectionCompaniesPreview } from "@/lib/org-network-match";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  const { orgId, userId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 5;

  const result = await listOrgConnectionCompaniesPreview(
    orgId,
    userId,
    Number.isFinite(limit) ? limit : 5,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    companies: result.companies,
    totalCount: result.totalCount,
    targetCount: result.targetCount,
  });
}
