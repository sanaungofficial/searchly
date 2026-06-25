import { CoachStatus } from "@prisma/client";

/** Prisma `NOT { userId }` excludes rows where userId IS NULL — include unlinked coach profiles. */
export function activeCoachListWhere(excludeUserId?: string) {
  if (!excludeUserId) {
    return { status: CoachStatus.ACTIVE };
  }
  return {
    status: CoachStatus.ACTIVE,
    OR: [{ userId: null }, { userId: { not: excludeUserId } }],
  };
}
