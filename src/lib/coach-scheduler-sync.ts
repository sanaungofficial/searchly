import { prisma } from "@/lib/prisma";
import { coachProfileSlug } from "@/lib/coach-slug";
import { schedulerAvailabilityFromProfile } from "@/lib/coach-scheduler-settings";
import {
  ensureCoachSchedulerConfig,
  isNylasConfigured,
  schedulerSlugForCoach,
  updateCoachSchedulerConfig,
  type CoachSchedulerParams,
} from "@/lib/nylas";

const schedulerProfileSelect = {
  id: true,
  displayName: true,
  email: true,
  slug: true,
  nylasGrantId: true,
  nylasSchedulerConfigId: true,
  nylasSchedulerSlug: true,
  schedulerDurationMinutes: true,
  schedulerTimezone: true,
  schedulerOpenHourStart: true,
  schedulerOpenHourEnd: true,
  schedulerOpenDays: true,
  schedulerWeeklyHours: true,
  schedulerBufferMinutes: true,
  schedulerMinBookingNoticeMinutes: true,
  schedulerCapacityHoursPerWeek: true,
  schedulerAvailabilityNotes: true,
  schedulerBlackoutDates: true,
} as const;

type CoachSchedulerProfile = {
  id: string;
  displayName: string;
  email: string | null;
  slug: string | null;
  nylasGrantId: string | null;
  nylasSchedulerConfigId: string | null;
  nylasSchedulerSlug: string | null;
  schedulerTimezone?: string | null;
  schedulerOpenHourStart?: string | null;
  schedulerOpenHourEnd?: string | null;
  schedulerOpenDays?: number[] | null;
  schedulerDurationMinutes?: number | null;
  schedulerWeeklyHours?: unknown;
  schedulerBufferMinutes?: number | null;
  schedulerMinBookingNoticeMinutes?: number | null;
  schedulerCapacityHoursPerWeek?: number | null;
  schedulerAvailabilityNotes?: string | null;
  schedulerBlackoutDates?: unknown;
};

function schedulerParamsFromSettings(
  profile: CoachSchedulerProfile,
  schedulerSlug: string,
  settings: ReturnType<typeof schedulerAvailabilityFromProfile>,
): CoachSchedulerParams {
  return {
    grantId: profile.nylasGrantId!,
    coachName: profile.displayName,
    coachEmail: profile.email ?? "",
    slug: schedulerSlug,
    durationMinutes: settings.durationMinutes,
    timezone: settings.timezone,
    openHourStart: settings.openHourStart,
    openHourEnd: settings.openHourEnd,
    openDays: settings.openDays,
    weeklyHours: settings.weeklyHours,
    bufferMinutes: settings.bufferMinutes,
    minBookingNoticeMinutes: settings.minBookingNoticeMinutes,
    availabilityNotes: settings.availabilityNotes,
    blackoutDates: settings.blackoutDates,
  };
}

export async function syncCoachSchedulerFromProfile(profileId: string) {
  if (!isNylasConfigured()) return null;

  const profile = await prisma.coachProfile.findUnique({
    where: { id: profileId },
    select: schedulerProfileSelect,
  });

  if (!profile?.nylasGrantId) return null;

  const slug = profile.slug ?? coachProfileSlug(profile.displayName, profile.id);
  const schedulerSlug = profile.nylasSchedulerSlug ?? schedulerSlugForCoach(slug, profile.id);
  const settings = schedulerAvailabilityFromProfile(profile);

  const result = await ensureCoachSchedulerConfig({
    configId: profile.nylasSchedulerConfigId,
    ...schedulerParamsFromSettings(profile, schedulerSlug, settings),
  });

  if (result.created || result.configId !== profile.nylasSchedulerConfigId) {
    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        nylasSchedulerConfigId: result.configId,
        ...(result.slug ? { nylasSchedulerSlug: result.slug } : {}),
      },
    });
  }

  return result;
}

/** Sync Nylas scheduler config before loading slots (e.g. intro vs full session duration). */
export async function prepareCoachSchedulerForAvailability(
  profile: CoachSchedulerProfile,
  durationMinutes: number,
) {
  if (!isNylasConfigured() || !profile.nylasGrantId || !profile.nylasSchedulerConfigId) return;

  const slug = profile.slug ?? coachProfileSlug(profile.displayName, profile.id);
  const schedulerSlug = profile.nylasSchedulerSlug ?? schedulerSlugForCoach(slug, profile.id);
  const settings = schedulerAvailabilityFromProfile(profile, { durationMinutes });

  await updateCoachSchedulerConfig({
    ...schedulerParamsFromSettings(profile, schedulerSlug, settings),
    configId: profile.nylasSchedulerConfigId,
  });
}
