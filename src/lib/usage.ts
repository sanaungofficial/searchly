import { prisma } from "@/lib/prisma";
import { FREE_MONTHLY_CREDITS, toCreditBalance, type CreditBalance } from "@/lib/credits";

/** @deprecated use FREE_MONTHLY_CREDITS */
export const FREE_AI_LIMIT = FREE_MONTHLY_CREDITS;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export async function getUsage(userId: string): Promise<CreditBalance> {
  const month = currentMonth();
  const row = await prisma.monthlyUsage.findUnique({
    where: { userId_month: { userId, month } },
  });
  const used = row?.count ?? 0;
  return toCreditBalance(used, FREE_MONTHLY_CREDITS);
}

export async function consumeCredit(
  userId: string,
  proUser: boolean,
): Promise<{ allowed: boolean } & CreditBalance> {
  if (proUser) {
    return { allowed: true, used: 0, limit: FREE_MONTHLY_CREDITS, remaining: FREE_MONTHLY_CREDITS };
  }

  const month = currentMonth();
  const row = await prisma.monthlyUsage.findUnique({
    where: { userId_month: { userId, month } },
  });
  const used = row?.count ?? 0;

  if (used >= FREE_MONTHLY_CREDITS) {
    return {
      allowed: false,
      ...toCreditBalance(used, FREE_MONTHLY_CREDITS),
    };
  }

  await prisma.monthlyUsage.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, count: 1 },
    update: { count: { increment: 1 } },
  });

  return {
    allowed: true,
    ...toCreditBalance(used + 1, FREE_MONTHLY_CREDITS),
  };
}

/** @deprecated use consumeCredit */
export async function checkAndIncrementUsage(
  userId: string,
  proUser: boolean,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const result = await consumeCredit(userId, proUser);
  return { allowed: result.allowed, used: result.used, limit: result.limit };
}
