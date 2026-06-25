import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { coachProfileSlug } from "@/lib/coach-slug";
import {
  exchangeNylasCode,
  createCoachSchedulerConfig,
  getNylasConfig,
  nylasProfileReturnUrl,
  schedulerSlugForCoach,
  verifyNylasState,
} from "@/lib/nylas";

async function profileOwnerRole(coachProfileId: string): Promise<UserRole | null> {
  const profile = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: {
      user: { select: { role: true } },
    },
  });
  return profile?.user?.role ?? null;
}

export async function GET(req: NextRequest) {
  const cfg = getNylasConfig();
  const fallback = cfg?.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kimchi.so";

  if (!cfg) {
    return NextResponse.redirect(
      nylasProfileReturnUrl(fallback, "ADMIN", { nylas: "error", reason: "config" }),
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const parsed = verifyNylasState(state ?? "");
  const role = parsed ? await profileOwnerRole(parsed.coachProfileId) : UserRole.ADMIN;
  const returnRole = role === UserRole.COACH ? "COACH" : "ADMIN";

  function redirectWith(params: Record<string, string>) {
    return NextResponse.redirect(nylasProfileReturnUrl(cfg.appUrl, returnRole, params));
  }

  if (error || !code || !state) {
    return redirectWith({ nylas: "error", reason: "auth" });
  }

  if (!parsed) {
    return redirectWith({ nylas: "error", reason: "state" });
  }

  try {
    const { grantId, email } = await exchangeNylasCode(code);
    const profile = await prisma.coachProfile.findUnique({ where: { id: parsed.coachProfileId } });
    if (!profile) {
      return redirectWith({ nylas: "error", reason: "profile" });
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

    return redirectWith({ nylas: "connected" });
  } catch {
    return redirectWith({ nylas: "error", reason: "setup" });
  }
}
