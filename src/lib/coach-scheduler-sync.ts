import { prisma } from "@/lib/prisma";
import { coachProfileSlug } from "@/lib/coach-slug";
import {
  schedulerAvailabilityFromProfile,
  type CoachSchedulerAvailabilitySettings,
} from "@/lib/coach-scheduler-settings";
import {
  ensureCoachSchedulerConfig,
  isNylasConfigured,
  schedulerSlugForCoach,
  updateCoachSchedulerConfig,
  type CoachSchedulerParams,
} from "@/lib/nylas";

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
};

function schedulerParamsFromProfile(
  profile: CoachSchedulerProfile,
  settings: CoachSchedulerAvailabilitySettings,
  schedulerSlug: string,
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
  };
}

export async function syncCoachSchedulerFromProfile(profileId: string) {
  if (!isNylasConfigured()) return null;

  const profile = await prisma.coachProfile.findUnique({
    where: { id: profileId },
    select: {
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
    },
  });

  if (!profile?.nylasGrantId) return null;

  const slug = profile.slug ?? coachProfileSlug(profile.displayName, profile.id);
  const schedulerSlug = profile.nylasSchedulerSlug ?? schedulerSlugForCoach(slug, profile.id);
  const settings = schedulerAvailabilityFromProfile(profile);

  const result = await ensureCoachSchedulerConfig({
    grantId: profile.nylasGrantId,
    configId: profile.nylasSchedulerConfigId,
    coachName: profile.displayName,
    coachEmail: profile.email ?? "",
    slug: schedulerSlug,
    durationMinutes: settings.durationMinutes,
    timezone: settings.timezone,
    openHourStart: settings.openHourStart,
    openHourEnd: settings.openHourEnd,
    openDays: settings.openDays,
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
    ...schedulerParamsFromProfile(profile, settings, schedulerSlug),
    configId: profile.nylasSchedulerConfigId,
  });
}
