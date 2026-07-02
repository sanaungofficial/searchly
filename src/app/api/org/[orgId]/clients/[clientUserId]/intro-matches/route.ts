import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import {
  computeOrgIntroMatches,
  listOrgIntroMatchPreview,
  listOrgIntroMatches,
  type OrgIntroMatchRow,
} from "@/lib/org-network-match";
import { listOrgIntroTrackingByContactIds } from "@/lib/org-intro-tracking";
import { prisma } from "@/lib/prisma";

async function attachIntroTracking(orgId: string, clientUserId: string, matches: OrgIntroMatchRow[]) {
  const contactIds = matches.map((m) => m.contact.id);
  const tracking = await listOrgIntroTrackingByContactIds(orgId, clientUserId, contactIds);
  return matches.map((row) => ({
    ...row,
    introTracking: tracking.get(row.contact.id) ?? null,
  }));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; clientUserId: string }> },
) {
  const { orgId, clientUserId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true, name: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const preview = req.nextUrl.searchParams.get("preview") === "true";
  const limitParam = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "5", 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 20)) : 5;

  if (preview) {
    const result = await listOrgIntroMatchPreview(orgId, clientUserId, limit);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    const matches = await attachIntroTracking(orgId, clientUserId, result.matches);
    return NextResponse.json({
      org: { id: org.id, name: org.name },
      clientId: clientUserId,
      matches,
      totalCount: result.totalCount,
    });
  }

  const result = await listOrgIntroMatches(orgId, clientUserId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  const matches = await attachIntroTracking(orgId, clientUserId, result.matches);

  return NextResponse.json({
    org: { id: org.id, name: org.name },
    clientId: clientUserId,
    matches,
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

  const matches = await attachIntroTracking(orgId, clientUserId, result.matches);

  return NextResponse.json({
    org: { id: org.id, name: org.name },
    clientId: clientUserId,
    targetsScanned: result.targetsScanned,
    matches,
  });
}
