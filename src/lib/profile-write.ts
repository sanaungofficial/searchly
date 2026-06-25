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
