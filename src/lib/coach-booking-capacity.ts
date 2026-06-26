import { CoachBookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CoachBookingSlot } from "@/lib/coach-booking-nylas";

const ACTIVE_STATUSES: CoachBookingStatus[] = [
  CoachBookingStatus.CONFIRMED,
  CoachBookingStatus.PENDING,
  CoachBookingStatus.RESCHEDULED,
];

function weekBounds(date: Date, timezone: string): { start: Date; end: Date } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const local = new Date(Date.UTC(y, m, d));
  const day = local.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(local);
  weekStart.setUTCDate(local.getUTCDate() + diff);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  return { start: weekStart, end: weekEnd };
}

function slotHours(slot: CoachBookingSlot): number {
  return (slot.endTime - slot.startTime) / 3600;
}

/** Drop slots that would exceed the coach's weekly booking capacity. */
export async function filterSlotsByWeeklyCapacity(params: {
  coachProfileId: string;
  slots: CoachBookingSlot[];
  capacityHoursPerWeek: number | null | undefined;
  timezone?: string | null;
}): Promise<CoachBookingSlot[]> {
  const cap = params.capacityHoursPerWeek;
  if (cap == null || cap <= 0) return params.slots;

  const tz = params.timezone ?? "America/New_York";
  const byWeek = new Map<string, number>();

  for (const slot of params.slots) {
    const { start, end } = weekBounds(new Date(slot.startTime * 1000), tz);
    const key = start.toISOString();
    if (!byWeek.has(key)) {
      const bookings = await prisma.coachBooking.findMany({
        where: {
          coachProfileId: params.coachProfileId,
          status: { in: ACTIVE_STATUSES },
          startAt: { gte: start, lt: end },
        },
        select: { startAt: true, endAt: true },
      });
      const hours = bookings.reduce(
        (sum, b) => sum + (b.endAt.getTime() - b.startAt.getTime()) / 3_600_000,
        0,
      );
      byWeek.set(key, hours);
    }
  }

  const weekUsage = new Map(byWeek);

  return params.slots.filter((slot) => {
    const { start } = weekBounds(new Date(slot.startTime * 1000), tz);
    const key = start.toISOString();
    const used = weekUsage.get(key) ?? byWeek.get(key) ?? 0;
    const hours = slotHours(slot);
    if (used + hours > cap) return false;
    weekUsage.set(key, used + hours);
    return true;
  });
}
