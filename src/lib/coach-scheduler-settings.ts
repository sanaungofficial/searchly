export const DEFAULT_SCHEDULER_TIMEZONE = "America/New_York";
export const DEFAULT_OPEN_HOUR_START = "09:00";
export const DEFAULT_OPEN_HOUR_END = "17:00";
export const DEFAULT_OPEN_DAYS = [1, 2, 3, 4, 5] as const;

export const SCHEDULER_TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
] as const;

const OPEN_HOUR_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function normalizeOpenHourTime(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  const match = trimmed.match(OPEN_HOUR_RE);
  if (!match) return fallback;
  const hour = String(Number(match[1])).padStart(2, "0");
  const minute = match[2];
  return `${hour}:${minute}`;
}

export function normalizeOpenDays(days: number[] | null | undefined): number[] {
  if (!days?.length) return [...DEFAULT_OPEN_DAYS];
  const unique = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return unique.length ? unique.sort((a, b) => a - b) : [...DEFAULT_OPEN_DAYS];
}

export type CoachSchedulerAvailabilitySettings = {
  timezone: string;
  openHourStart: string;
  openHourEnd: string;
  openDays: number[];
  durationMinutes: number;
};

export function schedulerAvailabilityFromProfile(
  profile: {
    schedulerTimezone?: string | null;
    schedulerOpenHourStart?: string | null;
    schedulerOpenHourEnd?: string | null;
    schedulerOpenDays?: number[] | null;
    schedulerDurationMinutes?: number | null;
  },
  overrides?: { durationMinutes?: number },
): CoachSchedulerAvailabilitySettings {
  const durationMinutes = overrides?.durationMinutes ?? profile.schedulerDurationMinutes ?? 30;
  const clampedDuration = Math.min(120, Math.max(15, Math.round(durationMinutes)));

  return {
    timezone: profile.schedulerTimezone?.trim() || DEFAULT_SCHEDULER_TIMEZONE,
    openHourStart: normalizeOpenHourTime(profile.schedulerOpenHourStart, DEFAULT_OPEN_HOUR_START),
    openHourEnd: normalizeOpenHourTime(profile.schedulerOpenHourEnd, DEFAULT_OPEN_HOUR_END),
    openDays: normalizeOpenDays(profile.schedulerOpenDays),
    durationMinutes: clampedDuration,
  };
}

export function parseSchedulerAvailabilityPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};

  if (body.schedulerTimezone !== undefined) {
    const tz = String(body.schedulerTimezone ?? "").trim();
    patch.schedulerTimezone = tz || DEFAULT_SCHEDULER_TIMEZONE;
  }
  if (body.schedulerOpenHourStart !== undefined) {
    patch.schedulerOpenHourStart = normalizeOpenHourTime(
      String(body.schedulerOpenHourStart ?? ""),
      DEFAULT_OPEN_HOUR_START,
    );
  }
  if (body.schedulerOpenHourEnd !== undefined) {
    patch.schedulerOpenHourEnd = normalizeOpenHourTime(
      String(body.schedulerOpenHourEnd ?? ""),
      DEFAULT_OPEN_HOUR_END,
    );
  }
  if (body.schedulerOpenDays !== undefined) {
    patch.schedulerOpenDays = normalizeOpenDays(body.schedulerOpenDays as number[]);
  }
  if (body.schedulerDurationMinutes !== undefined) {
    const mins = Number(body.schedulerDurationMinutes);
    patch.schedulerDurationMinutes = Number.isFinite(mins)
      ? Math.min(120, Math.max(15, Math.round(mins)))
      : 30;
  }

  return patch;
}

export function schedulerAvailabilityChanged(body: Record<string, unknown>) {
  return (
    body.schedulerTimezone !== undefined ||
    body.schedulerOpenHourStart !== undefined ||
    body.schedulerOpenHourEnd !== undefined ||
    body.schedulerOpenDays !== undefined ||
    body.schedulerDurationMinutes !== undefined
  );
}
