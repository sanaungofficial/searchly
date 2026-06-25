import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CoachStatus, UserRole } from "@prisma/client";
import { coachProfileSlug } from "@/lib/coach-slug";
import {
  clearNylasOAuthCookie,
  createCoachSchedulerConfig,
  exchangeNylasCode,
  getNylasConfig,
  mapNylasOAuthError,
  nylasOAuthRedirectUri,
  nylasProfileReturnUrl,
  resolveKimchiAppUrl,
  resolveNylasOAuthState,
  schedulerSlugForCoach,
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
  const appUrl = resolveKimchiAppUrl(req);
  const cfg = getNylasConfig(appUrl);

  if (!cfg) {
    return NextResponse.redirect(
      nylasProfileReturnUrl(appUrl, "ADMIN", { nylas: "error", reason: "config" }),
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  const oauthErrorReason = req.nextUrl.searchParams.get("error_reason");
  const oauthErrorDescription = req.nextUrl.searchParams.get("error_description");

  const parsedEarly = resolveNylasOAuthState(req, state);
  const role = parsedEarly ? await profileOwnerRole(parsedEarly.coachProfileId) : UserRole.ADMIN;
  const returnRole = role === UserRole.COACH ? "COACH" : "ADMIN";
  const profileAppUrl = parsedEarly?.returnAppUrl ?? appUrl;

  function redirectWith(params: Record<string, string>) {
    const response = NextResponse.redirect(nylasProfileReturnUrl(profileAppUrl, returnRole, params));
    clearNylasOAuthCookie(response);
    return response;
  }

  if (oauthError || oauthErrorReason) {
    console.error("[nylas/callback] OAuth error", {
      error: oauthError,
      error_reason: oauthErrorReason,
      error_description: oauthErrorDescription,
      params: Object.fromEntries(req.nextUrl.searchParams.entries()),
    });
    const mapped = mapNylasOAuthError({
      error: oauthError,
      errorReason: oauthErrorReason,
      errorDescription: oauthErrorDescription,
    });
    return redirectWith({
      nylas: "error",
      reason: mapped.reason,
      ...(mapped.detail ? { detail: mapped.detail } : {}),
    });
  }

  if (!code) {
    console.error("[nylas/callback] Missing authorization code", {
      params: Object.fromEntries(req.nextUrl.searchParams.entries()),
      redirectUri: nylasOAuthRedirectUri(),
    });
    return redirectWith({ nylas: "error", reason: "auth", detail: "missing_code" });
  }

  const parsed = parsedEarly;
  if (!parsed) {
    console.error("[nylas/callback] Invalid OAuth state", {
      hasState: Boolean(state),
      hasCookie: Boolean(req.cookies.get("nylas_oauth_state")?.value),
    });
    return redirectWith({ nylas: "error", reason: "state" });
  }

  try {
    const { grantId, email } = await exchangeNylasCode(code, appUrl);
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
      durationMinutes: profile.schedulerDurationMinutes ?? 30,
    });

    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        nylasGrantId: grantId,
        nylasSchedulerConfigId: configId,
        nylasSchedulerSlug: hostedSlug ?? schedulerSlug,
        ...(returnRole === "ADMIN" ? { status: CoachStatus.ACTIVE } : {}),
        ...(slug !== profile.slug ? { slug } : {}),
      },
    });

    return redirectWith({ nylas: "connected" });
  } catch (err) {
    console.error("[nylas/callback]", err);
    const message = err instanceof Error ? err.message : "Scheduler setup failed";
    return redirectWith({
      nylas: "error",
      reason: "setup",
      ...(message ? { detail: message.slice(0, 200) } : {}),
    });
  }
}
