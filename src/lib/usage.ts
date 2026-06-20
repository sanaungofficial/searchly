import { prisma } from "@/lib/prisma";

export const FREE_AI_LIMIT = 10;

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export async function getUsage(userId: string): Promise<{ used: number; limit: number }> {
  const month = currentMonth();
  const row = await prisma.monthlyUsage.findUnique({
    where: { userId_month: { userId, month } },
  });
  return { used: row?.count ?? 0, limit: FREE_AI_LIMIT };
}

export async function checkAndIncrementUsage(
  userId: string,
  proUser: boolean
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (proUser) return { allowed: true, used: 0, limit: Infinity };

  const month = currentMonth();
  const row = await prisma.monthlyUsage.findUnique({
    where: { userId_month: { userId, month } },
  });
  const used = row?.count ?? 0;

  if (used >= FREE_AI_LIMIT) {
    return { allowed: false, used, limit: FREE_AI_LIMIT };
  }

  await prisma.monthlyUsage.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, count: 1 },
    update: { count: { increment: 1 } },
  });

  return { allowed: true, used: used + 1, limit: FREE_AI_LIMIT };
}
