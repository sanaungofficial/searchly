import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CoachStatus, UserRole } from "@prisma/client";
import { coachProfileSlug } from "@/lib/coach-slug";
import { ensureJobAgentSettings } from "@/lib/job-agent-settings";
import { syncInboxActivities } from "@/lib/inbox-crm";
import { syncNylasContactsForUser } from "@/lib/inbox-crm/sync-contacts";
import { completeOrgNetworkOAuth } from "@/lib/org-network-source";
import {
  clearNylasOAuthCookie,
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
import { introSchedulerSlugSuffix } from "@/lib/coach-scheduler-config";
import { syncCoachSchedulerFromProfile } from "@/lib/coach-scheduler-sync";

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
  const isOrgNetworkFlow = parsedEarly?.kind === "orgNetwork";
  const returnAppUrl = parsedEarly?.returnAppUrl ?? appUrl;

  function redirectOrgNetwork(params: Record<string, string>) {
    const returnPath =
      parsedEarly?.kind === "orgNetwork" && parsedEarly.returnPath
        ? parsedEarly.returnPath
        : "/admin/orgs";
    const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
    const qs = new URLSearchParams(params).toString();
    const response = NextResponse.redirect(`${returnAppUrl.replace(/\/$/, "")}${path}${qs ? `?${qs}` : ""}`);
    clearNylasOAuthCookie(response);
    return response;
  }

  function redirectUser(params: Record<string, string>) {
    const returnPath =
      parsedEarly?.kind === "user" && parsedEarly.returnPath
        ? parsedEarly.returnPath
        : "/profile/preferences";
    const response = NextResponse.redirect(nylasUserInboxReturnUrl(returnAppUrl, params, returnPath));
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
    if (isOrgNetworkFlow) return redirectOrgNetwork(params);
    return isUserFlow ? redirectUser(params) : redirectCoach(params);
  }

  if (!cfg) {
    return await redirectWith(
      isOrgNetworkFlow
        ? { network: "error", reason: "config" }
        : isUserFlow
          ? { inbox: "error", reason: "config" }
          : { nylas: "error", reason: "config" },
    );
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
    const key = isOrgNetworkFlow ? "network" : isUserFlow ? "inbox" : "nylas";
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
      isOrgNetworkFlow
        ? { network: "error", reason: "auth", detail: "missing_code" }
        : isUserFlow
          ? { inbox: "error", reason: "auth", detail: "missing_code" }
          : { nylas: "error", reason: "auth", detail: "missing_code" },
    );
  }

  const parsed = parsedEarly;
  if (!parsed) {
    return await redirectWith(
      isOrgNetworkFlow
        ? { network: "error", reason: "state" }
        : isUserFlow
          ? { inbox: "error", reason: "state" }
          : { nylas: "error", reason: "state" },
    );
  }

  try {
    const { grantId, email } = await exchangeNylasCode(code, appUrl);

    if (parsed.kind === "orgNetwork") {
      await completeOrgNetworkOAuth({
        orgMemberId: parsed.orgMemberId,
        userId: parsed.userId,
        nylasGrantId: grantId,
        email: email ?? null,
        provider: req.nextUrl.searchParams.get("provider") ?? "google",
        visibility: parsed.visibility,
      });

      return redirectOrgNetwork({ network: "connected" });
    }

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

      syncInboxActivities(parsed.userId).catch((err) =>
        console.error("[nylas/callback] initial inbox sync", err),
      );
      syncNylasContactsForUser(parsed.userId).catch((err) =>
        console.error("[nylas/callback] initial contacts sync", err),
      );

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
    const introSlug = introSchedulerSlugSuffix(schedulerSlug);
    const emailSync = parsed.kind === "coach" && Boolean(parsed.emailSync);

    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        nylasGrantId: grantId,
        nylasGrantEmail: email ?? null,
        nylasGrantStatus: "active",
        nylasEmailSyncEnabled: emailSync,
        nylasSchedulerSlug: schedulerSlug,
        nylasIntroSchedulerSlug: introSlug,
        ...(returnRole === "ADMIN" ? { status: CoachStatus.ACTIVE } : {}),
        ...(slug !== profile.slug ? { slug } : {}),
      },
    });

    await syncCoachSchedulerFromProfile(profile.id);

    return await redirectCoach({ nylas: "connected" });
  } catch (err) {
    console.error("[nylas/callback]", err);
    const message = err instanceof Error ? err.message : "Setup failed";
    return await redirectWith({
      ...(isOrgNetworkFlow ? { network: "error" } : isUserFlow ? { inbox: "error" } : { nylas: "error" }),
      reason: "setup",
      ...(message ? { detail: message.slice(0, 200) } : {}),
    });
  }
}
