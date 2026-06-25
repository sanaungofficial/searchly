import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/** Required defaults when creating a Profile row (Postgres NOT NULL columns). */
export const PROFILE_CREATE_DEFAULTS = {
  targetRoles: [] as string[],
  priorities: [] as string[],
};

/** Update profile fields; creates the row with safe defaults if missing. */
export async function upsertProfileFields(
  userId: string,
  data: Prisma.ProfileUpdateInput,
): Promise<void> {
  const updated = await prisma.profile.updateMany({
    where: { userId },
    data,
  });
  if (updated.count > 0) return;

  await prisma.profile.create({
    data: {
      userId,
      ...PROFILE_CREATE_DEFAULTS,
      ...(data as Prisma.ProfileCreateInput),
    },
  });
}

/** Ensure a Profile row exists before strategy/intake AI routes read it. */
export async function ensureProfileRow(userId: string): Promise<void> {
  const existing = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return;
  await upsertProfileFields(userId, {});
}
