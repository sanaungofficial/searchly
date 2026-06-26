import { prisma } from "@/lib/prisma";

/** Ensure agent settings exist — auto-enabled for all users. */
export async function ensureJobAgentSettings(userId: string) {
  return prisma.userJobAgentSettings.upsert({
    where: { userId },
    create: { userId, enabled: true, autoApplyUpdates: true },
    update: {},
  });
}

export async function getJobAgentSettings(userId: string) {
  return ensureJobAgentSettings(userId);
}
