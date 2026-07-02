import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import { listOrgContacts } from "@/lib/org-contact-graph";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const sortParam = sp.get("sort");
  const result = await listOrgContacts({
    orgId,
    company: sp.get("company"),
    search: sp.get("search"),
    sort: sortParam === "strength" ? "strength" : "activity",
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    offset: sp.get("offset") ? Number(sp.get("offset")) : undefined,
  });

  return NextResponse.json({ org: { id: org.id, name: org.name }, ...result });
}
