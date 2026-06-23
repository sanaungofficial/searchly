import { prisma } from "@/lib/prisma";
import {
  FREE_MONTHLY_CREDITS,
  toCreditBalance,
  toUnlimitedBalance,
  type CreditBalance,
} from "@/lib/credits";

/** @deprecated use FREE_MONTHLY_CREDITS */
export const FREE_AI_LIMIT = FREE_MONTHLY_CREDITS;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function readMonthlyCount(userId: string): Promise<number> {
  const month = currentMonth();
  const row = await prisma.monthlyUsage.findUnique({
    where: { userId_month: { userId, month } },
  });
  return row?.count ?? 0;
}

async function incrementMonthlyCount(userId: string): Promise<number> {
  const month = currentMonth();
  const row = await prisma.monthlyUsage.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, count: 1 },
    update: { count: { increment: 1 } },
  });
  return row.count;
}

export async function getUsage(
  userId: string,
  options?: { unlimited?: boolean },
): Promise<CreditBalance> {
  const used = await readMonthlyCount(userId);
  if (options?.unlimited) return toUnlimitedBalance(used);
  return toCreditBalance(used, FREE_MONTHLY_CREDITS);
}

export async function consumeCredit(
  userId: string,
  unlimited: boolean,
): Promise<{ allowed: boolean } & CreditBalance> {
  const used = await readMonthlyCount(userId);

  if (!unlimited && used >= FREE_MONTHLY_CREDITS) {
    return {
      allowed: false,
      ...toCreditBalance(used, FREE_MONTHLY_CREDITS),
    };
  }

  const newUsed = await incrementMonthlyCount(userId);

  return unlimited
    ? { allowed: true, ...toUnlimitedBalance(newUsed) }
    : { allowed: true, ...toCreditBalance(newUsed, FREE_MONTHLY_CREDITS) };
}

/** @deprecated use consumeCredit */
export async function checkAndIncrementUsage(
  userId: string,
  proUser: boolean,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const result = await consumeCredit(userId, proUser);
  return { allowed: result.allowed, used: result.used, limit: result.limit };
}
