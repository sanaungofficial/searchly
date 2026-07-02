import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import { attachNylasOAuthCookie, buildOrgNetworkOAuthRedirect } from "@/lib/org-network-connect";
import {
  linkOrgNetworkSourceFromGrant,
  orgNetworkMemberReturnPath,
  parseNetworkPoolVisibility,
  serializeOrgNetworkSource,
} from "@/lib/org-network-source";
import { prisma } from "@/lib/prisma";
import { isNylasConfigured, resolveKimchiAppUrl } from "@/lib/nylas";

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const membership = auth.membership
    ?? await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: auth.user.id } },
      include: { user: { select: { id: true, email: true } } },
    });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const visibility = parseNetworkPoolVisibility(body.visibility) ?? "PRIVATE";
  const provider = body.provider === "microsoft" ? "microsoft" : "google";
  const appUrl = resolveKimchiAppUrl(req);
  const returnPath = orgNetworkMemberReturnPath(orgId);

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const existingGrant = await prisma.userEmailGrant.findUnique({
    where: { userId: membership.userId },
  });
  if (existingGrant) {
    const linked = await linkOrgNetworkSourceFromGrant({
      orgMemberId: membership.id,
      grant: existingGrant,
      visibility,
    });
    return NextResponse.json({
      linked: true,
      source: serializeOrgNetworkSource(linked),
    });
  }

  try {
    const { url, oauthPayload } = buildOrgNetworkOAuthRedirect({
      orgMemberId: membership.id,
      userId: membership.userId,
      userEmail: membership.user?.email ?? auth.user.email,
      visibility,
      returnPath,
      provider,
      appUrl,
    });
    const response = NextResponse.json({ authUrl: url });
    attachNylasOAuthCookie(response, oauthPayload);
    return response;
  } catch (err) {
    console.error("[org network-source/connect]", err);
    return NextResponse.json({ error: "Could not start inbox connect" }, { status: 500 });
  }
}
