import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isPro } from "@/lib/stripe";
import { consumeFeatureCredit, type FeatureCreditStatus } from "@/lib/feature-credits";
import { hasActiveProTrial } from "@/lib/referrals";
import { CREDITS_EXHAUSTED_ERROR, UNLIMITED_AI_FOR_ALL } from "@/lib/credits";
import type { PlanCreditFeature } from "@prisma/client";
import { getActingUser, quotaUserFor } from "@/lib/acting-user";
import { resolveProfileApiSubject } from "@/lib/admin-client-subject";

export async function getAuthedUserForAi(request?: Request) {
  const supabase = await createClient();

  let subjectUserId: string | null = null;
  let isImpersonating = false;
  let acting = await getActingUser(request);

  if (request) {
    const resolved = await resolveProfileApiSubject(request);
    if ("error" in resolved) {
      return { error: resolved.error as NextResponse };
    }
    acting = resolved.acting;
    subjectUserId = resolved.dbUser.id;
    isImpersonating = resolved.acting.isImpersonating;
  } else if (acting.dbUser) {
    subjectUserId = acting.dbUser.id;
    isImpersonating = acting.isImpersonating;
  }

  if (!acting.authUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse };
  }
  if (!subjectUserId) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) as NextResponse };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: subjectUserId },
    include: { profile: true, subscription: true },
  });
  if (!dbUser) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) as NextResponse };
  }

  const quotaUser = quotaUserFor(acting);
  const quotaDbUser = quotaUser
    ? await prisma.user.findUnique({
        where: { id: quotaUser.id },
        include: { subscription: true },
      })
    : null;

  return {
    dbUser,
    quotaDbUser: quotaDbUser ?? dbUser,
    isImpersonating,
    supabase,
  };
}

export async function hasUnlimitedAiAccess(dbUser: {
  id: string;
  role: string;
  subscription: { status: string; stripeCurrentPeriodEnd: Date } | null;
}): Promise<boolean> {
  if (UNLIMITED_AI_FOR_ALL) return true;
  if (dbUser.role === "ADMIN") return true;
  if (isPro(dbUser.subscription)) return true;
  return hasActiveProTrial(dbUser.id);
}

/** @deprecated use hasUnlimitedAiAccess */
export function isProOrAdmin(dbUser: {
  role: string;
  subscription: { status: string; stripeCurrentPeriodEnd: Date } | null;
}): boolean {
  return isPro(dbUser.subscription) || dbUser.role === "ADMIN";
}

function creditsErrorBody(status: FeatureCreditStatus) {
  return {
    error: CREDITS_EXHAUSTED_ERROR,
    code: "CREDITS_EXHAUSTED",
    feature: status.feature,
    used: status.used,
    limit: status.dailyLimit,
    remaining: status.remaining,
    bonusRemaining: status.bonusRemaining,
  };
}

/** Returns a 402 response if the daily feature credit balance is exhausted. */
export async function requireAiQuota(
  dbUser: {
    id: string;
    role: string;
    subscription: { status: string; stripeCurrentPeriodEnd: Date } | null;
  },
  feature: PlanCreditFeature,
  quotaDbUser?: {
    id: string;
    role: string;
    subscription: { status: string; stripeCurrentPeriodEnd: Date } | null;
  },
): Promise<NextResponse | null> {
  let billingUser = quotaDbUser ?? dbUser;
  if (!quotaDbUser) {
    const acting = await getActingUser();
    if (acting.isImpersonating && acting.realDbUser) {
      const adminWithSub = await prisma.user.findUnique({
        where: { id: acting.realDbUser.id },
        include: { subscription: true },
      });
      if (adminWithSub) billingUser = adminWithSub;
    }
  }
  const unlimited = await hasUnlimitedAiAccess(billingUser);
  const { allowed, ...status } = await consumeFeatureCredit(dbUser.id, feature, unlimited);
  if (!allowed) {
    return NextResponse.json(creditsErrorBody(status), { status: 402 });
  }
  return null;
}

export function aiLimitJsonResponse(status: FeatureCreditStatus): Response {
  return new Response(JSON.stringify(creditsErrorBody(status)), {
    status: 402,
    headers: { "Content-Type": "application/json" },
  });
}
