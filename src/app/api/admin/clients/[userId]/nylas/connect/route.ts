import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  attachNylasOAuthCookie,
  buildNylasAuthUrl,
  isNylasConfigured,
  resolveKimchiAppUrl,
  signNylasOAuthState,
} from "@/lib/nylas";
import { ensureJobAgentSettings } from "@/lib/job-agent-settings";
import { withClientUserId } from "@/lib/workspace-urls";

function adminClientInboxReturnPath(clientUserId: string) {
  return withClientUserId("/networking?tab=inbox", clientUserId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const appUrl = resolveKimchiAppUrl(req);
  const { userId: clientUserId } = await params;

  if (!isNylasConfigured()) {
    const qs = new URLSearchParams({ inbox: "error", reason: "config" }).toString();
    return NextResponse.redirect(`${appUrl}${adminClientInboxReturnPath(clientUserId)}?${qs}`);
  }

  const client = await prisma.user.findUnique({
    where: { id: clientUserId },
    select: { id: true, email: true, role: true },
  });
  if (!client || client.role !== "USER") {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  await ensureJobAgentSettings(client.id);

  const provider = req.nextUrl.searchParams.get("provider") === "microsoft" ? "microsoft" : "google";
  const oauthPayload = {
    kind: "user" as const,
    userId: client.id,
    ts: Date.now(),
    returnAppUrl: appUrl,
    returnPath: adminClientInboxReturnPath(client.id),
  };
  const state = signNylasOAuthState(oauthPayload);

  try {
    const url = buildNylasAuthUrl({
      provider,
      state,
      loginHint: client.email ?? undefined,
      inboxAccess: true,
    });
    const response = NextResponse.redirect(url);
    attachNylasOAuthCookie(response, oauthPayload);
    return response;
  } catch (err) {
    console.error("[admin clients nylas connect]", err);
    const reason =
      err instanceof Error && (err.message.includes("RedirectURI") || err.message.includes("redirect"))
        ? "redirect"
        : "setup";
    const qs = new URLSearchParams({ inbox: "error", reason }).toString();
    return NextResponse.redirect(`${appUrl}${adminClientInboxReturnPath(client.id)}?${qs}`);
  }
}
