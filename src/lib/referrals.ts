import { prisma } from "@/lib/prisma";
import { grantFeatureBonus } from "@/lib/feature-credits";
import { REFERRAL_BONUS_PER_FEATURE, LINKEDIN_SHARE_PRO_DAYS } from "@/lib/plan-config";
import {
  ensurePartneroCustomer,
  getPartneroCustomerStats,
  partneroEnabled,
  partneroReferralLink,
  recordPartneroOnboardingTransaction,
} from "@/lib/partnero";
import type { PlanCreditFeature } from "@prisma/client";

const CODE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateReferralCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // collision — retry
    }
  }
  throw new Error("Failed to generate referral code");
}

export async function attachReferrer(refereeId: string, referralCodeOrId: string): Promise<boolean> {
  const referrer = await prisma.user.findFirst({
    where: { OR: [{ referralCode: referralCodeOrId }, { id: referralCodeOrId }] },
    select: { id: true },
  });
  if (!referrer || referrer.id === refereeId) return false;

  await prisma.user.update({
    where: { id: refereeId },
    data: { referredByUserId: referrer.id },
  });
  return true;
}

const REFERRAL_BONUS_FEATURES: PlanCreditFeature[] = ["MATCH", "TAILOR", "INSIDER"];

async function grantReferralBonuses(userId: string, amount: number) {
  for (const feature of REFERRAL_BONUS_FEATURES) {
    await grantFeatureBonus(userId, feature, amount);
  }
}

/** Idempotent — call when referee finishes onboarding. */
export async function completeReferral(refereeId: string): Promise<{ completed: boolean }> {
  const referee = await prisma.user.findUnique({
    where: { id: refereeId },
    select: { referredByUserId: true, onboardingCompletedAt: true },
  });
  if (!referee?.referredByUserId) return { completed: false };

  const existing = await prisma.referralEvent.findUnique({ where: { refereeId } });
  if (existing) return { completed: false };

  const bonus = REFERRAL_BONUS_PER_FEATURE;

  await prisma.$transaction(async (tx) => {
    await tx.referralEvent.create({
      data: {
        referrerId: referee.referredByUserId!,
        refereeId,
        matchBonus: bonus,
        tailorBonus: bonus,
        insiderBonus: bonus,
      },
    });
    await tx.user.update({
      where: { id: refereeId },
      data: { onboardingCompletedAt: new Date() },
    });
  });

  await grantReferralBonuses(referee.referredByUserId!, bonus);
  await grantReferralBonuses(refereeId, bonus);

  if (partneroEnabled()) {
    await recordPartneroOnboardingTransaction(refereeId).catch((e) => {
      console.error("[referrals] Partnero onboarding transaction", e);
    });
  }

  return { completed: true };
}

export async function getReferralStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const [code, events, linkedInPending, bonusRows] = await Promise.all([
    ensureReferralCode(userId),
    prisma.referralEvent.findMany({
      where: { referrerId: userId },
      select: { matchBonus: true, tailorBonus: true, insiderBonus: true },
    }),
    prisma.linkedInShareSubmission.findFirst({
      where: { userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.featureCreditBonus.findMany({ where: { userId } }),
  ]);

  let link = referralLink(code);
  let partneroReferrals = 0;
  if (partneroEnabled() && user?.email) {
    const customer = await ensurePartneroCustomer({
      userId,
      email: user.email,
      name: user.name,
    }).catch(() => null);
    if (customer) {
      link = partneroReferralLink(customer, userId);
    }
    const poStats = await getPartneroCustomerStats(userId).catch(() => null);
    partneroReferrals =
      (poStats?.referrals_count as number | undefined) ??
      (poStats?.referrals as number | undefined) ??
      0;
  }

  const invitesCompleted = Math.max(events.length, partneroReferrals);
  let matchEarned = 0;
  let tailorEarned = 0;
  let insiderEarned = 0;
  for (const e of events) {
    matchEarned += e.matchBonus;
    tailorEarned += e.tailorBonus;
    insiderEarned += e.insiderBonus;
  }

  const bonusByFeature = Object.fromEntries(bonusRows.map((r) => [r.feature, r.remaining]));

  return {
    code,
    link,
    invitesCompleted,
    matchCreditsEarned: matchEarned,
    tailorCreditsEarned: tailorEarned,
    insiderCreditsEarned: insiderEarned,
    bonusRemaining: bonusByFeature,
    linkedInPending: !!linkedInPending,
  };
}

export async function submitLinkedInShare(userId: string, postUrl: string) {
  const trimmed = postUrl.trim();
  if (!trimmed.includes("linkedin.com")) {
    throw new Error("Please paste a valid LinkedIn post URL");
  }

  const pending = await prisma.linkedInShareSubmission.findFirst({
    where: { userId, status: "PENDING" },
  });
  if (pending) {
    throw new Error("You already have a submission under review");
  }

  return prisma.linkedInShareSubmission.create({
    data: { userId, postUrl: trimmed },
  });
}

/** Admin/manual: approve LinkedIn share → 5 days Pro trial. */
export async function approveLinkedInShare(submissionId: string) {
  const sub = await prisma.linkedInShareSubmission.update({
    where: { id: submissionId },
    data: { status: "APPROVED" },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + LINKEDIN_SHARE_PRO_DAYS);

  await prisma.proTrialGrant.create({
    data: {
      userId: sub.userId,
      expiresAt,
      source: "linkedin_share",
    },
  });

  return sub;
}

export async function hasActiveProTrial(userId: string): Promise<boolean> {
  const grant = await prisma.proTrialGrant.findFirst({
    where: { userId, expiresAt: { gt: new Date() } },
  });
  return !!grant;
}

export function referralLink(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kimchi.so";
  return `${base}/r/${code}`;
}
