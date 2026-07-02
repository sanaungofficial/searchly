import { NextRequest, NextResponse } from "next/server";
import {
  addEmployeeTargetCompany,
  listEmployeeTargetCompanies,
  removeEmployeeTargetCompany,
} from "@/lib/org-employee-targets";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  const { orgId, userId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const companies = await listEmployeeTargetCompanies(userId);
  return NextResponse.json({ companies });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  const { orgId, userId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { name?: string; website?: string | null };
  const result = await addEmployeeTargetCompany(orgId, userId, {
    name: body.name ?? "",
    website: body.website,
  });

  if (!result.ok) {
    const status = result.error.includes("Already") ? 409 : 400;
    return NextResponse.json(
      { error: result.error, existing: "existing" in result ? result.existing : undefined },
      { status },
    );
  }

  return NextResponse.json({ company: result.company });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> },
) {
  const { orgId, userId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { companyId?: string };
  if (!body.companyId?.trim()) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const result = await removeEmployeeTargetCompany(orgId, userId, body.companyId.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
