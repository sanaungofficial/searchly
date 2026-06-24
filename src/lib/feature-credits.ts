import { prisma } from "@/lib/prisma";
import type { PlanCreditFeature } from "@prisma/client";

/** JobRight-style free daily limits per feature. */
export const FREE_DAILY_LIMITS: Record<PlanCreditFeature, number | null> = {
  MATCH: 2,
  TAILOR: 2,
  COVER_LETTER: 2,
  SCOUT: 4,
  INSIDER: 2,
  READBACK: 2,
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export type FeatureCreditStatus = {
  feature: PlanCreditFeature;
  used: number;
  dailyLimit: number | null;
  bonusRemaining: number;
  remaining: number | null;
  unlimited: boolean;
};

async function readDailyCount(userId: string, feature: PlanCreditFeature): Promise<number> {
  const row = await prisma.dailyFeatureUsage.findUnique({
    where: { userId_day_feature: { userId, day: todayKey(), feature } },
  });
  return row?.count ?? 0;
}

async function readBonus(userId: string, feature: PlanCreditFeature): Promise<number> {
  const row = await prisma.featureCreditBonus.findUnique({
    where: { userId_feature: { userId, feature } },
  });
  return row?.remaining ?? 0;
}

export async function getFeatureCreditStatus(
  userId: string,
  feature: PlanCreditFeature,
  unlimited: boolean,
): Promise<FeatureCreditStatus> {
  const used = await readDailyCount(userId, feature);
  const bonusRemaining = await readBonus(userId, feature);
  const dailyLimit = FREE_DAILY_LIMITS[feature];

  if (unlimited) {
    return { feature, used, dailyLimit, bonusRemaining, remaining: null, unlimited: true };
  }

  const dailyRemaining = dailyLimit === null ? null : Math.max(0, dailyLimit - used);
  const remaining =
    dailyRemaining === null ? bonusRemaining : dailyRemaining + bonusRemaining;

  return { feature, used, dailyLimit, bonusRemaining, remaining, unlimited: false };
}

export async function consumeFeatureCredit(
  userId: string,
  feature: PlanCreditFeature,
  unlimited: boolean,
): Promise<{ allowed: boolean } & FeatureCreditStatus> {
  if (unlimited) {
    const used = await readDailyCount(userId, feature);
    await incrementDaily(userId, feature);
    return {
      allowed: true,
      ...(await getFeatureCreditStatus(userId, feature, true)),
      used: used + 1,
    };
  }

  const status = await getFeatureCreditStatus(userId, feature, false);
  if ((status.remaining ?? 0) <= 0) {
    return { allowed: false, ...status };
  }

  const bonus = await readBonus(userId, feature);
  if (bonus > 0) {
    await prisma.featureCreditBonus.update({
      where: { userId_feature: { userId, feature } },
      data: { remaining: { decrement: 1 } },
    });
  } else {
    await incrementDaily(userId, feature);
  }

  return { allowed: true, ...(await getFeatureCreditStatus(userId, feature, false)) };
}

async function incrementDaily(userId: string, feature: PlanCreditFeature) {
  const day = todayKey();
  await prisma.dailyFeatureUsage.upsert({
    where: { userId_day_feature: { userId, day, feature } },
    create: { userId, day, feature, count: 1 },
    update: { count: { increment: 1 } },
  });
}

export async function grantFeatureBonus(
  userId: string,
  feature: PlanCreditFeature,
  amount: number,
) {
  await prisma.featureCreditBonus.upsert({
    where: { userId_feature: { userId, feature } },
    create: { userId, feature, remaining: amount },
    update: { remaining: { increment: amount } },
  });
}

export async function getAllFeatureCredits(userId: string, unlimited: boolean) {
  const features: PlanCreditFeature[] = [
    "MATCH",
    "TAILOR",
    "COVER_LETTER",
    "SCOUT",
    "INSIDER",
    "READBACK",
  ];
  return Promise.all(features.map((f) => getFeatureCreditStatus(userId, f, unlimited)));
}

/** Map API routes to plan credit features. */
export const ROUTE_FEATURE_MAP = {
  match: "MATCH" as PlanCreditFeature,
  tailor: "TAILOR" as PlanCreditFeature,
  coverLetter: "COVER_LETTER" as PlanCreditFeature,
  scout: "SCOUT" as PlanCreditFeature,
  insider: "INSIDER" as PlanCreditFeature,
  readback: "READBACK" as PlanCreditFeature,
};
