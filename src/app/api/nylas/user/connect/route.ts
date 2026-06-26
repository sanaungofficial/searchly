import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  attachNylasOAuthCookie,
  buildNylasAuthUrl,
  isNylasConfigured,
  nylasUserInboxReturnUrl,
  resolveKimchiAppUrl,
  signNylasOAuthState,
} from "@/lib/nylas";
import { ensureJobAgentSettings } from "@/lib/job-agent-settings";

export async function GET(req: NextRequest) {
  const appUrl = resolveKimchiAppUrl(req);

  if (!isNylasConfigured()) {
    return NextResponse.redirect(nylasUserInboxReturnUrl(appUrl, { inbox: "error", reason: "config" }));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.redirect(nylasUserInboxReturnUrl(appUrl, { inbox: "error", reason: "auth" }));
  }

  const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } });
  if (!dbUser) {
    return NextResponse.redirect(nylasUserInboxReturnUrl(appUrl, { inbox: "error", reason: "profile" }));
  }

  await ensureJobAgentSettings(dbUser.id);

  const returnTo = req.nextUrl.searchParams.get("returnTo");
  const returnPath = returnTo === "opportunities" ? "/opportunities/inbox" : "/profile/preferences";

  const provider = req.nextUrl.searchParams.get("provider") === "microsoft" ? "microsoft" : "google";
  const oauthPayload = {
    kind: "user" as const,
    userId: dbUser.id,
    ts: Date.now(),
    returnAppUrl: appUrl,
    returnPath,
  };
  const state = signNylasOAuthState(oauthPayload);

  try {
    const url = buildNylasAuthUrl({
      provider,
      state,
      loginHint: user.email,
      inboxAccess: true,
    });
    const response = NextResponse.redirect(url);
    attachNylasOAuthCookie(response, oauthPayload);
    return response;
  } catch (err) {
    console.error("[nylas/user/connect]", err);
    return NextResponse.redirect(nylasUserInboxReturnUrl(appUrl, { inbox: "error", reason: "setup" }));
  }
}
