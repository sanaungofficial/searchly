import {
  type CoachSchedulerAvailabilitySettings,
  type SchedulerDayHours,
  DEFAULT_OPEN_DAYS,
  DEFAULT_OPEN_HOUR_END,
  DEFAULT_OPEN_HOUR_START,
  schedulerAvailabilityFromProfile,
  weeklyHoursFromLegacyProfile,
  WEEKDAY_LABELS,
} from "@/lib/coach-scheduler-settings";

export type ConceptualSlot = { startTime: number; endTime: number };

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function parseHourMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function formatHourLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

function timezoneAbbreviation(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" })
      .formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
  } catch {
    return timezone;
  }
}

/** When a coach has no hours configured, fall back to Mon–Fri 9am–5pm so request-to-book always has slots. */
function weeklyHoursWithDefaults(weeklyHours: SchedulerDayHours[]): SchedulerDayHours[] {
  if (weeklyHours.some((row) => row.enabled)) return weeklyHours;
  return weeklyHoursFromLegacyProfile({
    schedulerOpenHourStart: DEFAULT_OPEN_HOUR_START,
    schedulerOpenHourEnd: DEFAULT_OPEN_HOUR_END,
    schedulerOpenDays: [...DEFAULT_OPEN_DAYS],
  });
}

/** Human-readable summary of a coach's configured weekly hours (not live calendar sync). */
export function formatCoachAvailabilitySummary(
  profile: Parameters<typeof schedulerAvailabilityFromProfile>[0],
): { summary: string; timezone: string; availabilityNotes: string | null } {
  const settings = schedulerAvailabilityFromProfile(profile);
  const weeklyHours = weeklyHoursWithDefaults(settings.weeklyHours);
  const enabled = weeklyHours.filter((row) => row.enabled);
  const tz = settings.timezone;
  const tzShort = timezoneAbbreviation(tz);

  if (!enabled.length) {
    return {
      summary: "Availability by request",
      timezone: tz,
      availabilityNotes: settings.availabilityNotes,
    };
  }

  const hourGroups = new Map<string, number[]>();
  for (const row of enabled) {
    const key = `${row.start}|${row.end}`;
    const days = hourGroups.get(key) ?? [];
    days.push(row.day);
    hourGroups.set(key, days);
  }

  const parts: string[] = [];
  for (const [key, days] of hourGroups) {
    const [start, end] = key.split("|");
    const sorted = [...days].sort((a, b) => a - b);
    const dayLabel = formatDayRange(sorted);
    const timeLabel = `${formatHourLabel(parseHourMinutes(start))}–${formatHourLabel(parseHourMinutes(end))}`;
    parts.push(`${dayLabel}, ${timeLabel}`);
  }

  const summary = parts.length === 1 ? `${parts[0]} ${tzShort}` : `${parts.join(" · ")} (${tzShort})`;

  return {
    summary,
    timezone: tz,
    availabilityNotes: settings.availabilityNotes,
  };
}

function formatDayRange(days: number[]): string {
  if (days.length === 1) return DAY_SHORT[days[0]!] ?? "Day";
  if (days.length === 7) return "Every day";

  const labels = days.map((d) => DAY_SHORT[d] ?? "");
  const consecutive =
    days.length > 1 &&
    days.every((d, i) => i === 0 || d === days[i - 1]! + 1);

  if (consecutive) return `${labels[0]}–${labels[labels.length - 1]}`;

  if (days.length <= 3) return labels.join(", ");
  return `${labels[0]}–${labels[labels.length - 1]}`;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Typical time windows from scheduler settings — not real-time availability. */
export function generateConceptualAvailabilitySlots(
  profile: Parameters<typeof schedulerAvailabilityFromProfile>[0],
  options?: { startDate?: Date; days?: number; durationMinutes?: number },
): ConceptualSlot[] {
  const settings = schedulerAvailabilityFromProfile(profile, {
    durationMinutes: options?.durationMinutes,
  });
  const durationMinutes = settings.durationMinutes;
  const slotSeconds = durationMinutes * 60;
  const startDate = startOfLocalDay(options?.startDate ?? new Date());
  const dayCount = options?.days ?? 14;
  const weeklyByDay = new Map(weeklyHoursWithDefaults(settings.weeklyHours).map((row) => [row.day, row]));
  const slots: ConceptualSlot[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  for (let offset = 0; offset < dayCount; offset += 1) {
    const day = addDays(startDate, offset);
    const row = weeklyByDay.get(day.getDay());
    if (!row?.enabled) continue;

    const openStart = parseHourMinutes(row.start);
    const openEnd = parseHourMinutes(row.end);
    if (openEnd <= openStart) continue;

    for (let minute = openStart; minute + durationMinutes <= openEnd; minute += durationMinutes) {
      const slotStart = new Date(day);
      slotStart.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      const startTime = Math.floor(slotStart.getTime() / 1000);
      if (startTime < nowSec + 3600) continue;
      slots.push({ startTime, endTime: startTime + slotSeconds });
    }
  }

  return slots;
}

export function describeConceptualAvailability(settings: CoachSchedulerAvailabilitySettings): string {
  const enabledCount = settings.weeklyHours.filter((row) => row.enabled).length;
  if (!enabledCount) return "Send a request with times that work for you.";
  return `Pick preferred times within ${formatCoachAvailabilitySummary({
    schedulerTimezone: settings.timezone,
    schedulerWeeklyHours: settings.weeklyHours,
    schedulerOpenHourStart: settings.openHourStart,
    schedulerOpenHourEnd: settings.openHourEnd,
    schedulerOpenDays: settings.openDays,
    schedulerAvailabilityNotes: settings.availabilityNotes,
  }).summary}. Your coach will confirm.`;
}

export { WEEKDAY_LABELS };
