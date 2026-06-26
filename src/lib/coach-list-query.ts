import { CoachStatus } from "@prisma/client";

/** Prisma `NOT { userId }` excludes rows where userId IS NULL — include unlinked coach profiles. */
export function activeCoachListWhere(excludeUserId?: string, options?: { includeInternal?: boolean }) {
  const base: Record<string, unknown> = {
    status: CoachStatus.ACTIVE,
    ...(options?.includeInternal ? {} : { isInternal: false }),
  };

  if (!excludeUserId) return base;

  return {
    ...base,
    OR: [{ userId: null }, { userId: { not: excludeUserId } }],
  };
}
