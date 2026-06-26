/** Resolve which email receives coach booking notifications. */
export function resolveCoachNotificationEmail(coach: {
  email?: string | null;
  nylasGrantEmail?: string | null;
}): string | null {
  return coach.nylasGrantEmail?.trim() || coach.email?.trim() || null;
}
