import { NextRequest, NextResponse } from "next/server";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import { attachNylasOAuthCookie, buildOrgNetworkOAuthRedirect } from "@/lib/org-network-connect";
import {
  getOrgMemberById,
  linkOrgNetworkSourceFromGrant,
  orgNetworkAdminReturnPath,
  serializeOrgNetworkSource,
} from "@/lib/org-network-source";
import { syncOrgNetworkSource } from "@/lib/org-contact-graph";
import { prisma } from "@/lib/prisma";
import { isNylasConfigured, resolveKimchiAppUrl } from "@/lib/nylas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> },
) {
  const { orgId, memberId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const member = await getOrgMemberById(memberId, orgId);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const provider = body.provider === "microsoft" ? "microsoft" : "google";
  const appUrl = resolveKimchiAppUrl(req);
  const returnPath = orgNetworkAdminReturnPath(orgId);

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const existingGrant = await prisma.userEmailGrant.findUnique({
    where: { userId: member.userId },
  });
  if (existingGrant) {
    const linked = await linkOrgNetworkSourceFromGrant({
      orgMemberId: member.id,
      grant: existingGrant,
    });
    syncOrgNetworkSource(linked.id).catch((err) =>
      console.error("[admin org member network-source/connect] backfill", err),
    );
    return NextResponse.json({
      linked: true,
      source: serializeOrgNetworkSource(linked),
    });
  }

  try {
    const { url, oauthPayload } = buildOrgNetworkOAuthRedirect({
      orgMemberId: member.id,
      userId: member.userId,
      userEmail: member.user.email,
      visibility: "POOLED",
      returnPath,
      provider,
      appUrl,
    });
    const response = NextResponse.json({ authUrl: url });
    attachNylasOAuthCookie(response, oauthPayload);
    return response;
  } catch (err) {
    console.error("[admin org member network-source/connect]", err);
    return NextResponse.json({ error: "Could not start inbox connect" }, { status: 500 });
  }
}
