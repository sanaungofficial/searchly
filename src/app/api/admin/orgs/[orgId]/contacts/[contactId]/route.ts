import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import { getOrgContactDetail } from "@/lib/org-contact-graph";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ orgId: string; contactId: string }> },
) {
  const { orgId, contactId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const contact = await getOrgContactDetail(orgId, contactId);
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  return NextResponse.json({ org: { id: org.id, name: org.name }, contact });
}
