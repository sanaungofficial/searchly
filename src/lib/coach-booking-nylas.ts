import { CoachBookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createSchedulerBooking,
  getSchedulerAvailability,
  isNylasConfigured,
  type NylasTimeSlot,
} from "@/lib/nylas";

export const INTRO_SESSION_MINUTES = 30;

export type CoachBookingSlot = {
  startTime: number;
  endTime: number;
};

export function slotsFromNylas(slots: NylasTimeSlot[]): CoachBookingSlot[] {
  return slots.map((s) => ({ startTime: s.start_time, endTime: s.end_time }));
}

export async function fetchCoachAvailabilitySlots(params: {
  configurationId: string;
  startTime: number;
  endTime: number;
}): Promise<CoachBookingSlot[]> {
  const slots = await getSchedulerAvailability({
    configurationId: params.configurationId,
    startTime: params.startTime,
    endTime: params.endTime,
  });
  return slotsFromNylas(slots);
}

export async function findNextCoachSlot(params: {
  configurationId: string;
  lookaheadDays?: number;
}): Promise<CoachBookingSlot | null> {
  const now = Math.floor(Date.now() / 1000);
  const end = now + (params.lookaheadDays ?? 14) * 24 * 60 * 60;
  const slots = await fetchCoachAvailabilitySlots({
    configurationId: params.configurationId,
    startTime: now,
    endTime: end,
  });
  return slots[0] ?? null;
}

export async function createCoachBookingRecord(params: {
  coachProfileId: string;
  configurationId: string;
  startTime: number;
  endTime: number;
  guestName: string;
  guestEmail: string;
  title?: string;
  timezone?: string;
}) {
  if (!isNylasConfigured()) throw new Error("Nylas is not configured");

  const created = await createSchedulerBooking({
    configurationId: params.configurationId,
    startTime: params.startTime,
    endTime: params.endTime,
    guestName: params.guestName,
    guestEmail: params.guestEmail,
    timezone: params.timezone,
  });

  const startAt = new Date(params.startTime * 1000);
  const endAt = new Date(params.endTime * 1000);

  const data = {
    coachProfileId: params.coachProfileId,
    nylasBookingId: created.bookingId ?? null,
    nylasBookingRef: created.bookingRef ?? null,
    nylasConfigId: params.configurationId,
    nylasEventId: created.eventId ?? null,
    guestName: params.guestName,
    guestEmail: params.guestEmail,
    title: created.title ?? params.title ?? null,
    startAt,
    endAt,
    status: CoachBookingStatus.CONFIRMED,
    rawPayload: created as object,
  };

  if (created.bookingId) {
    const existing = await prisma.coachBooking.findUnique({
      where: { nylasBookingId: created.bookingId },
    });
    if (existing) {
      await prisma.coachBooking.update({ where: { id: existing.id }, data });
    } else {
      await prisma.coachBooking.create({ data });
    }
  } else if (created.bookingRef) {
    const existing = await prisma.coachBooking.findUnique({
      where: { nylasBookingRef: created.bookingRef },
    });
    if (existing) {
      await prisma.coachBooking.update({ where: { id: existing.id }, data });
    } else {
      await prisma.coachBooking.create({ data });
    }
  } else {
    await prisma.coachBooking.create({ data });
  }

  return {
    bookingId: created.bookingId,
    bookingRef: created.bookingRef,
    startAt,
    endAt,
    title: created.title ?? params.title,
  };
}
