export const DEFAULT_SCHEDULER_TIMEZONE = "America/New_York";
export const DEFAULT_OPEN_HOUR_START = "09:00";
export const DEFAULT_OPEN_HOUR_END = "17:00";
export const DEFAULT_OPEN_DAYS = [1, 2, 3, 4, 5] as const;
export const MIN_WEEKLY_AVAILABILITY_HOURS = 5;
export const DEFAULT_MIN_BOOKING_NOTICE_MINUTES = 1440;

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

export const BOOKING_NOTICE_OPTIONS = [
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "12 hours", minutes: 720 },
  { label: "24 hours", minutes: 1440 },
  { label: "48 hours", minutes: 2880 },
  { label: "1 week", minutes: 10080 },
] as const;

export const BUFFER_OPTIONS = [
  { label: "No buffer", minutes: 0 },
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "45 minutes", minutes: 45 },
  { label: "60 minutes", minutes: 60 },
] as const;

export const CAPACITY_OPTIONS = [
  { label: "5 hours / week", hours: 5 },
  { label: "10 hours / week", hours: 10 },
  { label: "15 hours / week", hours: 15 },
  { label: "20 hours / week", hours: 20 },
  { label: "25+ hours / week", hours: 25 },
] as const;

export const WEEKDAY_LABELS = [
  { day: 0, label: "Sunday" },
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
] as const;

const OPEN_HOUR_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SchedulerDayHours = {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
};

export type CoachSchedulerAvailabilitySettings = {
  timezone: string;
  openHourStart: string;
  openHourEnd: string;
  openDays: number[];
  durationMinutes: number;
  weeklyHours: SchedulerDayHours[];
  bufferMinutes: number;
  minBookingNoticeMinutes: number;
  capacityHoursPerWeek: number | null;
  availabilityNotes: string | null;
  blackoutDates: string[];
};

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

export function parseWeeklyHours(raw: unknown): SchedulerDayHours[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed: SchedulerDayHours[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const day = Number((item as SchedulerDayHours).day);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    parsed.push({
      day,
      enabled: Boolean((item as SchedulerDayHours).enabled),
      start: normalizeOpenHourTime((item as SchedulerDayHours).start, DEFAULT_OPEN_HOUR_START),
      end: normalizeOpenHourTime((item as SchedulerDayHours).end, DEFAULT_OPEN_HOUR_END),
    });
  }
  if (!parsed.length) return null;
  const byDay = new Map(parsed.map((d) => [d.day, d]));
  return WEEKDAY_LABELS.map(({ day }) => {
    const existing = byDay.get(day);
    return existing ?? { day, enabled: false, start: DEFAULT_OPEN_HOUR_START, end: DEFAULT_OPEN_HOUR_END };
  });
}

export function weeklyHoursFromLegacyProfile(profile: {
  schedulerOpenHourStart?: string | null;
  schedulerOpenHourEnd?: string | null;
  schedulerOpenDays?: number[] | null;
}): SchedulerDayHours[] {
  const start = normalizeOpenHourTime(profile.schedulerOpenHourStart, DEFAULT_OPEN_HOUR_START);
  const end = normalizeOpenHourTime(profile.schedulerOpenHourEnd, DEFAULT_OPEN_HOUR_END);
  const openDays = normalizeOpenDays(profile.schedulerOpenDays);
  return WEEKDAY_LABELS.map(({ day }) => ({
    day,
    enabled: openDays.includes(day),
    start,
    end,
  }));
}

export function resolveWeeklyHours(
  profile: {
    schedulerWeeklyHours?: unknown;
    schedulerOpenHourStart?: string | null;
    schedulerOpenHourEnd?: string | null;
    schedulerOpenDays?: number[] | null;
  },
): SchedulerDayHours[] {
  return parseWeeklyHours(profile.schedulerWeeklyHours) ?? weeklyHoursFromLegacyProfile(profile);
}

export function parseBlackoutDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => String(d).trim())
    .filter((d) => DATE_RE.test(d))
    .sort();
}

export function weeklyAvailabilityHours(weekly: SchedulerDayHours[]): number {
  let totalMinutes = 0;
  for (const row of weekly) {
    if (!row.enabled) continue;
    const [sh, sm] = row.start.split(":").map(Number);
    const [eh, em] = row.end.split(":").map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;
    if (endM > startM) totalMinutes += endM - startM;
  }
  return totalMinutes / 60;
}

export function openDaysFromWeekly(weekly: SchedulerDayHours[]): number[] {
  return weekly.filter((d) => d.enabled).map((d) => d.day).sort((a, b) => a - b);
}

export function schedulerAvailabilityFromProfile(
  profile: {
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
  },
  overrides?: { durationMinutes?: number },
): CoachSchedulerAvailabilitySettings {
  const durationMinutes = overrides?.durationMinutes ?? profile.schedulerDurationMinutes ?? 30;
  const clampedDuration = Math.min(120, Math.max(15, Math.round(durationMinutes)));
  const weeklyHours = resolveWeeklyHours(profile);
  const enabled = weeklyHours.filter((d) => d.enabled);
  const openHourStart = enabled[0]?.start ?? normalizeOpenHourTime(profile.schedulerOpenHourStart, DEFAULT_OPEN_HOUR_START);
  const openHourEnd = enabled[0]?.end ?? normalizeOpenHourTime(profile.schedulerOpenHourEnd, DEFAULT_OPEN_HOUR_END);

  return {
    timezone: profile.schedulerTimezone?.trim() || DEFAULT_SCHEDULER_TIMEZONE,
    openHourStart,
    openHourEnd,
    openDays: openDaysFromWeekly(weeklyHours),
    durationMinutes: clampedDuration,
    weeklyHours,
    bufferMinutes: Math.min(120, Math.max(0, profile.schedulerBufferMinutes ?? 0)),
    minBookingNoticeMinutes: Math.max(0, profile.schedulerMinBookingNoticeMinutes ?? DEFAULT_MIN_BOOKING_NOTICE_MINUTES),
    capacityHoursPerWeek: profile.schedulerCapacityHoursPerWeek ?? null,
    availabilityNotes: profile.schedulerAvailabilityNotes?.trim() || null,
    blackoutDates: parseBlackoutDates(profile.schedulerBlackoutDates),
  };
}

export function buildNylasOpenHoursBlocks(
  weekly: SchedulerDayHours[],
  timezone: string,
  blackoutDates: string[],
) {
  const groups = new Map<string, number[]>();
  for (const row of weekly) {
    if (!row.enabled) continue;
    const key = `${row.start}|${row.end}`;
    const days = groups.get(key) ?? [];
    days.push(row.day);
    groups.set(key, days);
  }

  if (groups.size === 0) {
    return [
      {
        days: [1, 2, 3, 4, 5],
        start: DEFAULT_OPEN_HOUR_START,
        end: DEFAULT_OPEN_HOUR_END,
        timezone,
        ...(blackoutDates.length ? { exdates: blackoutDates } : {}),
      },
    ];
  }

  return Array.from(groups.entries()).map(([key, days]) => {
    const [start, end] = key.split("|");
    return {
      days: days.sort((a, b) => a - b),
      start,
      end,
      timezone,
      ...(blackoutDates.length ? { exdates: blackoutDates } : {}),
    };
  });
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
  if (body.schedulerWeeklyHours !== undefined) {
    const weekly = parseWeeklyHours(body.schedulerWeeklyHours);
    if (weekly) {
      patch.schedulerWeeklyHours = weekly;
      patch.schedulerOpenDays = openDaysFromWeekly(weekly);
      const enabled = weekly.filter((d) => d.enabled);
      if (enabled.length) {
        patch.schedulerOpenHourStart = enabled[0].start;
        patch.schedulerOpenHourEnd = enabled[0].end;
      }
    }
  }
  if (body.schedulerBufferMinutes !== undefined) {
    const mins = Number(body.schedulerBufferMinutes);
    patch.schedulerBufferMinutes = Number.isFinite(mins) ? Math.min(120, Math.max(0, Math.round(mins))) : 0;
  }
  if (body.schedulerMinBookingNoticeMinutes !== undefined) {
    const mins = Number(body.schedulerMinBookingNoticeMinutes);
    patch.schedulerMinBookingNoticeMinutes = Number.isFinite(mins) ? Math.max(0, Math.round(mins)) : DEFAULT_MIN_BOOKING_NOTICE_MINUTES;
  }
  if (body.schedulerCapacityHoursPerWeek !== undefined) {
    const hours = body.schedulerCapacityHoursPerWeek;
    patch.schedulerCapacityHoursPerWeek =
      hours === null || hours === "" ? null : Math.min(60, Math.max(1, Math.round(Number(hours))));
  }
  if (body.schedulerAvailabilityNotes !== undefined) {
    const notes = String(body.schedulerAvailabilityNotes ?? "").trim();
    patch.schedulerAvailabilityNotes = notes ? notes.slice(0, 500) : null;
  }
  if (body.schedulerBlackoutDates !== undefined) {
    patch.schedulerBlackoutDates = parseBlackoutDates(body.schedulerBlackoutDates);
  }
  if (body.nylasSchedulerCalendarIds !== undefined) {
    const ids = body.nylasSchedulerCalendarIds;
    if (Array.isArray(ids)) {
      patch.nylasSchedulerCalendarIds = ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    } else if (ids === null) {
      patch.nylasSchedulerCalendarIds = null;
    }
  }
  if (body.nylasConferenceProvider !== undefined) {
    const p = String(body.nylasConferenceProvider ?? "").trim();
    patch.nylasConferenceProvider =
      p === "google_meet" || p === "microsoft_teams" ? p : null;
  }

  return patch;
}

export function schedulerAvailabilityChanged(body: Record<string, unknown>) {
  return (
    body.schedulerTimezone !== undefined ||
    body.schedulerOpenHourStart !== undefined ||
    body.schedulerOpenHourEnd !== undefined ||
    body.schedulerOpenDays !== undefined ||
    body.schedulerDurationMinutes !== undefined ||
    body.schedulerWeeklyHours !== undefined ||
    body.schedulerBufferMinutes !== undefined ||
    body.schedulerMinBookingNoticeMinutes !== undefined ||
    body.schedulerCapacityHoursPerWeek !== undefined ||
    body.schedulerAvailabilityNotes !== undefined ||
    body.schedulerBlackoutDates !== undefined ||
    body.nylasSchedulerCalendarIds !== undefined ||
    body.nylasConferenceProvider !== undefined
  );
}

export function formatTimezoneLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "long",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
    return `${name} (${tz})`;
  } catch {
    return tz;
  }
}
