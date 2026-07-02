import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import {
  computeOrgIntroMatches,
  listOrgIntroMatches,
  listTopOrgIntroMatchesAcrossClients,
} from "@/lib/org-network-match";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; clientUserId: string }> },
) {
  const { orgId, clientUserId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const scope = req.nextUrl.searchParams.get("scope");
  if (scope === "org") {
    const topMatches = await listTopOrgIntroMatchesAcrossClients(orgId, 15);
    return NextResponse.json({ org: { id: org.id, name: org.name }, topMatches });
  }

  const result = await listOrgIntroMatches(orgId, clientUserId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({
    org: { id: org.id, name: org.name },
    clientId: clientUserId,
    matches: result.matches,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; clientUserId: string }> },
) {
  const { orgId, clientUserId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  let body: { companyName?: string; companyWebsite?: string; includeHirebase?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const result = await computeOrgIntroMatches({
    orgId,
    clientId: clientUserId,
    companyName: body.companyName,
    companyWebsite: body.companyWebsite,
    includeHirebase: body.includeHirebase !== false,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    org: { id: org.id, name: org.name },
    clientId: clientUserId,
    targetsScanned: result.targetsScanned,
    matches: result.matches,
  });
}
