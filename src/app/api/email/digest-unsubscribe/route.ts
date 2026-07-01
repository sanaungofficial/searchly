import { NextRequest, NextResponse } from "next/server";
import { verifyDigestUnsubscribeToken } from "@/lib/digest-unsubscribe";
import { prisma } from "@/lib/prisma";

import { resolveAppUrl } from "@/lib/site-host";

const APP_URL = resolveAppUrl();

/** One-click unsubscribe from daily job match emails. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.redirect(`${APP_URL}/email/unsubscribed?error=missing`);
  }

  const userId = verifyDigestUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.redirect(`${APP_URL}/email/unsubscribed?error=invalid`);
  }

  await prisma.userDigestSettings.upsert({
    where: { userId },
    create: { userId, dailyEmailEnabled: false },
    update: { dailyEmailEnabled: false, watchlistEmailEnabled: false, pipelineEmailEnabled: false },
  });

  return NextResponse.redirect(`${APP_URL}/email/unsubscribed?ok=1`);
}
