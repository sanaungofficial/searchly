import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coachProfileSlug } from "@/lib/coach-slug";
import {
  exchangeNylasCode,
  createCoachSchedulerConfig,
  getNylasConfig,
  schedulerSlugForCoach,
  verifyNylasState,
} from "@/lib/nylas";

export async function GET(req: NextRequest) {
  const cfg = getNylasConfig();
  if (!cfg) {
    const fallback = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kimchi.so";
    return NextResponse.redirect(`${fallback}/clients?tab=profile&nylas=error&reason=config`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const clientsUrl = `${cfg.appUrl.replace(/\/$/, "")}/clients?tab=profile`;

  if (error || !code || !state) {
    return NextResponse.redirect(`${clientsUrl}&nylas=error&reason=auth`);
  }

  const parsed = verifyNylasState(state);
  if (!parsed) {
    return NextResponse.redirect(`${clientsUrl}&nylas=error&reason=state`);
  }

  try {
    const { grantId, email } = await exchangeNylasCode(code);
    const profile = await prisma.coachProfile.findUnique({ where: { id: parsed.coachProfileId } });
    if (!profile) {
      return NextResponse.redirect(`${clientsUrl}&nylas=error&reason=profile`);
    }

    const slug = profile.slug ?? coachProfileSlug(profile.displayName, profile.id);
    const schedulerSlug = schedulerSlugForCoach(slug, profile.id);
    const coachEmail = email ?? profile.email ?? "";

    const { configId, slug: hostedSlug } = await createCoachSchedulerConfig({
      grantId,
      coachName: profile.displayName,
      coachEmail,
      slug: schedulerSlug,
    });

    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        nylasGrantId: grantId,
        nylasSchedulerConfigId: configId,
        nylasSchedulerSlug: hostedSlug ?? schedulerSlug,
        ...(slug !== profile.slug ? { slug } : {}),
      },
    });

    return NextResponse.redirect(`${clientsUrl}&nylas=connected`);
  } catch {
    return NextResponse.redirect(`${clientsUrl}&nylas=error&reason=setup`);
  }
}
