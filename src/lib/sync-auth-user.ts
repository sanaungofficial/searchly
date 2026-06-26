import type { User } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
import { attachReferrer } from "@/lib/referrals";
import { ensurePartneroCustomer, partneroEnabled } from "@/lib/partnero";

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

export function authRedirectForUser(isNewUser: boolean, next?: string | null) {
  if (next && next !== "/") return next;
  return isNewUser ? "/onboarding" : "/dashboard";
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
  const avatarUrl =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    null;

  const existing = await prisma.user.findUnique({ where: { email: user.email } });
  const preservedAvatar = existing?.avatarUrl ?? avatarUrl;
  const created = await prisma.user.upsert({
    where: { email: user.email },
    update: { name, avatarUrl: preservedAvatar },
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
  } else if (partneroEnabled()) {
    await ensurePartneroCustomer({
      userId: created.id,
      email: user.email,
      name,
    }).catch((e) => console.error("[provisionUserFromAuth] Partnero customer sync", e));
  }

  return { isNewUser, dbUser: created };
}
