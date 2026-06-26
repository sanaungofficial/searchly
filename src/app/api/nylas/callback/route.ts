import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CoachStatus, UserRole } from "@prisma/client";
import { coachProfileSlug } from "@/lib/coach-slug";
import { ensureJobAgentSettings } from "@/lib/job-agent-settings";
import { syncUserInbox } from "@/lib/job-email-agent";
import {
  clearNylasOAuthCookie,
  createCoachSchedulerConfig,
  exchangeNylasCode,
  getNylasConfig,
  mapNylasOAuthError,
  nylasOAuthRedirectUri,
  nylasProfileReturnUrl,
  nylasUserInboxReturnUrl,
  resolveKimchiAppUrl,
  resolveNylasOAuthState,
  schedulerSlugForCoach,
} from "@/lib/nylas";

async function profileOwnerRole(coachProfileId: string): Promise<UserRole | null> {
  const profile = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { user: { select: { role: true } } },
  });
  return profile?.user?.role ?? null;
}

export async function GET(req: NextRequest) {
  const appUrl = resolveKimchiAppUrl(req);
  const cfg = getNylasConfig(appUrl);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  const oauthErrorReason = req.nextUrl.searchParams.get("error_reason");
  const oauthErrorDescription = req.nextUrl.searchParams.get("error_description");

  const parsedEarly = resolveNylasOAuthState(req, state);
  const isUserFlow = parsedEarly?.kind === "user";
  const returnAppUrl = parsedEarly?.returnAppUrl ?? appUrl;

  function redirectUser(params: Record<string, string>) {
    const response = NextResponse.redirect(nylasUserInboxReturnUrl(returnAppUrl, params));
    clearNylasOAuthCookie(response);
    return response;
  }

  async function redirectCoach(params: Record<string, string>) {
    const returnAppUrl = (parsedEarly?.returnAppUrl ?? appUrl).replace(/\/$/, "");
    if (parsedEarly?.kind === "coach" && parsedEarly.returnPath) {
      const path = parsedEarly.returnPath.startsWith("/")
        ? parsedEarly.returnPath
        : `/${parsedEarly.returnPath}`;
      const qs = new URLSearchParams(params).toString();
      const response = NextResponse.redirect(`${returnAppUrl}${path}${qs ? `?${qs}` : ""}`);
      clearNylasOAuthCookie(response);
      return response;
    }

    const role = parsedEarly?.kind === "coach"
      ? await profileOwnerRole(parsedEarly.coachProfileId)
      : UserRole.ADMIN;
    const returnRole = role === UserRole.COACH ? "COACH" : "ADMIN";
    const response = NextResponse.redirect(nylasProfileReturnUrl(returnAppUrl, returnRole, params));
    clearNylasOAuthCookie(response);
    return response;
  }

  async function redirectWith(params: Record<string, string>) {
    return isUserFlow ? redirectUser(params) : redirectCoach(params);
  }

  if (!cfg) {
    return await redirectWith(isUserFlow ? { inbox: "error", reason: "config" } : { nylas: "error", reason: "config" });
  }

  if (oauthError || oauthErrorReason) {
    console.error("[nylas/callback] OAuth error", {
      error: oauthError,
      error_reason: oauthErrorReason,
      error_description: oauthErrorDescription,
    });
    const mapped = mapNylasOAuthError({
      error: oauthError,
      errorReason: oauthErrorReason,
      errorDescription: oauthErrorDescription,
    });
    const key = isUserFlow ? "inbox" : "nylas";
    return await redirectWith({
      [key]: "error",
      reason: mapped.reason,
      ...(mapped.detail ? { detail: mapped.detail } : {}),
    });
  }

  if (!code) {
    console.error("[nylas/callback] Missing authorization code", {
      redirectUri: nylasOAuthRedirectUri(),
    });
    return await redirectWith(
      isUserFlow
        ? { inbox: "error", reason: "auth", detail: "missing_code" }
        : { nylas: "error", reason: "auth", detail: "missing_code" },
    );
  }

  const parsed = parsedEarly;
  if (!parsed) {
    return await redirectWith(isUserFlow ? { inbox: "error", reason: "state" } : { nylas: "error", reason: "state" });
  }

  try {
    const { grantId, email } = await exchangeNylasCode(code, appUrl);

    if (parsed.kind === "user") {
      await ensureJobAgentSettings(parsed.userId);

      await prisma.userEmailGrant.upsert({
        where: { userId: parsed.userId },
        create: {
          userId: parsed.userId,
          nylasGrantId: grantId,
          email: email ?? null,
          provider: req.nextUrl.searchParams.get("provider") ?? "google",
        },
        update: {
          nylasGrantId: grantId,
          email: email ?? null,
          connectedAt: new Date(),
        },
      });

      syncUserInbox(parsed.userId).catch((err) => console.error("[nylas/callback] initial sync", err));

    return redirectUser({ inbox: "connected" });
    }

    const profile = await prisma.coachProfile.findUnique({ where: { id: parsed.coachProfileId } });
    if (!profile) {
      return await redirectCoach({ nylas: "error", reason: "profile" });
    }

    const role = await profileOwnerRole(parsed.coachProfileId);
    const returnRole = role === UserRole.COACH ? "COACH" : "ADMIN";

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

    return await redirectCoach({ nylas: "connected" });
  } catch (err) {
    console.error("[nylas/callback]", err);
    const message = err instanceof Error ? err.message : "Setup failed";
    return await redirectWith({
      ...(isUserFlow ? { inbox: "error" } : { nylas: "error" }),
      reason: "setup",
      ...(message ? { detail: message.slice(0, 200) } : {}),
    });
  }
}
