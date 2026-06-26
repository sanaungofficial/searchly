import { prisma } from "@/lib/prisma";
import { coachProfileSlug } from "@/lib/coach-slug";
import { introSchedulerSlugSuffix } from "@/lib/coach-scheduler-config";
import { schedulerAvailabilityFromProfile } from "@/lib/coach-scheduler-settings";
import {
  ensureCoachSchedulerConfig,
  getNylasGrantEmail,
  isNylasConfigured,
  schedulerSlugForCoach,
  type CoachSchedulerParams,
} from "@/lib/nylas";

const schedulerProfileSelect = {
  id: true,
  displayName: true,
  email: true,
  slug: true,
  nylasGrantId: true,
  nylasGrantEmail: true,
  nylasGrantStatus: true,
  nylasSchedulerConfigId: true,
  nylasIntroSchedulerConfigId: true,
  nylasSchedulerSlug: true,
  nylasIntroSchedulerSlug: true,
  nylasSchedulerCalendarIds: true,
  nylasConferenceProvider: true,
  introDurationMinutes: true,
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

export type CoachSchedulerProfile = {
  id: string;
  displayName: string;
  email: string | null;
  slug: string | null;
  nylasGrantId: string | null;
  nylasGrantEmail?: string | null;
  nylasGrantStatus?: string | null;
  nylasSchedulerConfigId: string | null;
  nylasIntroSchedulerConfigId?: string | null;
  nylasSchedulerSlug: string | null;
  nylasIntroSchedulerSlug?: string | null;
  nylasSchedulerCalendarIds?: unknown;
  nylasConferenceProvider?: string | null;
  introDurationMinutes?: number | null;
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

function calendarIdsFromProfile(profile: CoachSchedulerProfile): string[] | undefined {
  if (!profile.nylasSchedulerCalendarIds) return undefined;
  if (Array.isArray(profile.nylasSchedulerCalendarIds)) {
    const ids = (profile.nylasSchedulerCalendarIds as unknown[]).filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    return ids.length ? ids : undefined;
  }
  return undefined;
}

function conferenceProviderFromProfile(
  profile: CoachSchedulerProfile,
): "google_meet" | "microsoft_teams" | null {
  if (profile.nylasConferenceProvider === "google_meet") return "google_meet";
  if (profile.nylasConferenceProvider === "microsoft_teams") return "microsoft_teams";
  return null;
}

async function resolveParticipantEmail(profile: CoachSchedulerProfile): Promise<string> {
  if (profile.nylasGrantEmail?.trim()) return profile.nylasGrantEmail.trim();
  if (!profile.nylasGrantId) return profile.email?.trim() ?? "";

  const fromGrant = await getNylasGrantEmail(profile.nylasGrantId);
  if (fromGrant) {
    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: { nylasGrantEmail: fromGrant },
    });
    return fromGrant;
  }

  return profile.email?.trim() ?? "";
}

async function schedulerParamsFromSettings(
  profile: CoachSchedulerProfile,
  schedulerSlug: string,
  settings: ReturnType<typeof schedulerAvailabilityFromProfile>,
  sessionLabel: "intro" | "session",
): Promise<CoachSchedulerParams> {
  const coachEmail = await resolveParticipantEmail(profile);
  if (!coachEmail) {
    throw new Error("Calendar grant email missing — reconnect Google or Outlook for this coach.");
  }

  const calendarIds = calendarIdsFromProfile(profile);

  return {
    grantId: profile.nylasGrantId!,
    coachName: profile.displayName,
    coachEmail,
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
    calendarIds,
    bookingCalendarId: calendarIds?.[0],
    conferenceProvider: conferenceProviderFromProfile(profile),
    sessionLabel,
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
  const sessionSlug = profile.nylasSchedulerSlug ?? schedulerSlugForCoach(slug, profile.id);
  const introSlug =
    profile.nylasIntroSchedulerSlug ?? introSchedulerSlugSuffix(schedulerSlugForCoach(slug, profile.id));

  const sessionSettings = schedulerAvailabilityFromProfile(profile);
  const introSettings = schedulerAvailabilityFromProfile(profile, {
    durationMinutes: profile.introDurationMinutes ?? 30,
  });

  const sessionParams = await schedulerParamsFromSettings(profile, sessionSlug, sessionSettings, "session");
  const introParams = await schedulerParamsFromSettings(profile, introSlug, introSettings, "intro");

  const sessionResult = await ensureCoachSchedulerConfig({
    configId: profile.nylasSchedulerConfigId,
    ...sessionParams,
  });

  const introResult = await ensureCoachSchedulerConfig({
    configId: profile.nylasIntroSchedulerConfigId ?? null,
    ...introParams,
  });

  const updates: Record<string, string> = {};
  if (sessionResult.configId !== profile.nylasSchedulerConfigId) {
    updates.nylasSchedulerConfigId = sessionResult.configId;
  }
  if (sessionResult.slug && sessionResult.slug !== profile.nylasSchedulerSlug) {
    updates.nylasSchedulerSlug = sessionResult.slug;
  }
  if (introResult.configId !== profile.nylasIntroSchedulerConfigId) {
    updates.nylasIntroSchedulerConfigId = introResult.configId;
  }
  if (introResult.slug && introResult.slug !== profile.nylasIntroSchedulerSlug) {
    updates.nylasIntroSchedulerSlug = introResult.slug;
  }

  if (Object.keys(updates).length > 0) {
    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: updates,
    });
  }

  return {
    configId: sessionResult.configId,
    introConfigId: introResult.configId,
    created: sessionResult.created || introResult.created,
  };
}

/** @deprecated Dual configs replace runtime mutation — kept as no-op for callers during migration. */
export async function prepareCoachSchedulerForAvailability(
  _profile: CoachSchedulerProfile,
  _durationMinutes: number,
) {
  return;
}

export async function markCoachGrantExpired(coachProfileId: string) {
  await prisma.coachProfile.update({
    where: { id: coachProfileId },
    data: { nylasGrantStatus: "expired" },
  });
}

export async function disconnectCoachNylas(profileId: string) {
  const profile = await prisma.coachProfile.findUnique({
    where: { id: profileId },
    select: { nylasGrantId: true },
  });
  if (!profile) return;

  if (profile.nylasGrantId) {
    try {
      const { revokeNylasGrant } = await import("@/lib/nylas");
      await revokeNylasGrant(profile.nylasGrantId);
    } catch (err) {
      console.error("[coach-scheduler-sync] revoke grant", err);
    }
  }

  await prisma.coachProfile.update({
    where: { id: profileId },
    data: {
      nylasGrantId: null,
      nylasGrantEmail: null,
      nylasGrantStatus: null,
      nylasSchedulerConfigId: null,
      nylasIntroSchedulerConfigId: null,
      nylasSchedulerSlug: null,
      nylasIntroSchedulerSlug: null,
      nylasEmailSyncEnabled: false,
    },
  });
}
