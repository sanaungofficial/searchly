/** Resolve which Nylas scheduler configuration to use for intro vs full sessions. */

export type CoachSchedulerProfileRef = {
  nylasSchedulerConfigId?: string | null;
  nylasIntroSchedulerConfigId?: string | null;
  schedulerDurationMinutes?: number | null;
  introDurationMinutes?: number | null;
};

export function introDurationForCoach(profile: CoachSchedulerProfileRef): number {
  return profile.introDurationMinutes ?? 30;
}

export function sessionDurationForCoach(profile: CoachSchedulerProfileRef): number {
  return profile.schedulerDurationMinutes ?? 60;
}

export function isIntroDuration(profile: CoachSchedulerProfileRef, durationMinutes: number): boolean {
  return durationMinutes === introDurationForCoach(profile);
}

/** Pick scheduler config id for a slot duration or explicit session type. */
export function resolveSchedulerConfigId(
  profile: CoachSchedulerProfileRef,
  opts: { sessionType?: "intro" | "session"; durationMinutes?: number },
): string | null {
  const intro = introDurationForCoach(profile);
  const session = sessionDurationForCoach(profile);
  const duration = opts.durationMinutes ?? (opts.sessionType === "intro" ? intro : session);
  const useIntro = opts.sessionType === "intro" || duration === intro;

  if (useIntro && profile.nylasIntroSchedulerConfigId) {
    return profile.nylasIntroSchedulerConfigId;
  }
  return profile.nylasSchedulerConfigId ?? profile.nylasIntroSchedulerConfigId ?? null;
}

export function introSchedulerSlugSuffix(baseSlug: string): string {
  const trimmed = baseSlug.replace(/-intro$/, "");
  return `${trimmed}-intro`;
}
