import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
import { attachReferrer } from "@/lib/referrals";
import { ensureJobAgentSettings } from "@/lib/job-agent-settings";
import { ensurePartneroCustomer, partneroEnabled } from "@/lib/partnero";
import { APP_HOME_PATH } from "@/lib/site-host";
import {
  persistExternalImageToAvatarsBucket,
} from "@/lib/persist-external-image";

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

export function authRedirectForUser(
  onboardingCompletedAt: Date | null | undefined,
  next?: string | null,
) {
  if (next && next !== "/") return next;
  return onboardingCompletedAt ? APP_HOME_PATH : "/onboarding";
}

/** Server-side redirect — backfills completion for returning users who already have a profile. */
export async function resolveAuthRedirectForUser(
  dbUser: { id: string; onboardingCompletedAt: Date | null },
  next?: string | null,
) {
  if (next && next !== "/") return next;
  if (dbUser.onboardingCompletedAt) return APP_HOME_PATH;

  const profile = await prisma.profile.findUnique({
    where: { userId: dbUser.id },
    select: { id: true },
  });
  if (profile) {
    await markOnboardingComplete(dbUser.id);
    return APP_HOME_PATH;
  }

  return "/onboarding";
}

/** Mark onboarding finished — idempotent. */
export async function markOnboardingComplete(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, onboardingCompletedAt: null },
    data: { onboardingCompletedAt: new Date() },
  });
}

/** Upsert Prisma user + referral/welcome side effects after Supabase auth succeeds. */
export async function provisionUserFromAuth(user: User, cookieStore: CookieStore) {
  if (!user.email) {
    throw new Error("Authenticated user has no email");
  }

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email.split("@")[0];
  const oauthAvatarUrl =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    null;

  const existing = await prisma.user.findUnique({ where: { email: user.email } });
  let avatarUrl = existing?.avatarUrl ?? null;

  if (!avatarUrl && oauthAvatarUrl) {
    const persisted = await persistExternalImageToAvatarsBucket({
      sourceUrl: oauthAvatarUrl,
      storagePath: `${user.id}/avatar.jpg`,
    });
    avatarUrl = persisted.url ?? oauthAvatarUrl;
  }

  const created = await prisma.user.upsert({
    where: { email: user.email },
    update: { name, avatarUrl: existing?.avatarUrl ?? avatarUrl },
    create: { email: user.email, name, avatarUrl },
  });

  const isNewUser = !existing;

  if (isNewUser) {
    const refCode = cookieStore.get("kimchi_ref")?.value;
    const partneroRef = cookieStore.get("partnero_referral")?.value;

    let referringKey: string | null = partneroRef ?? null;
    if (!referringKey && refCode) {
      const referrer = await prisma.user.findFirst({
        where: { OR: [{ referralCode: refCode }, { id: refCode }] },
        select: { id: true },
      });
      referringKey = referrer?.id ?? null;
    }

    if (partneroEnabled()) {
      await ensurePartneroCustomer({
        userId: created.id,
        email: user.email,
        name,
        referringCustomerKey: referringKey,
      }).catch((e) => console.error("[provisionUserFromAuth] Partnero customer", e));
    }

    if (refCode) {
      await attachReferrer(created.id, refCode).catch(() => {});
    } else if (referringKey) {
      await attachReferrer(created.id, referringKey).catch(() => {});
    }

    if (process.env.RESEND_API_KEY) {
      sendWelcomeEmail(user.email, name).catch(() => {});
    }

    await ensureJobAgentSettings(created.id).catch(() => {});
  } else if (partneroEnabled()) {
    await ensurePartneroCustomer({
      userId: created.id,
      email: user.email,
      name,
    }).catch((e) => console.error("[provisionUserFromAuth] Partnero customer sync", e));
  }

  return { isNewUser, dbUser: created };
}
