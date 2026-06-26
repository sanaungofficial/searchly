import { CoachBookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sendBookingCoachNotificationEmail,
  sendBookingGuestConfirmationEmail,
} from "@/lib/booking-emails";
import { resolveCoachNotificationEmail } from "@/lib/coach-notification-email";
import { resolveGuestUserId } from "@/lib/coach-hub";
import {
  createSchedulerBooking,
  getSchedulerAvailability,
  isNylasConfigured,
  type NylasTimeSlot,
} from "@/lib/nylas";

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

async function persistBookingRecord(params: {
  coachProfileId: string;
  configurationId: string;
  startTime: number;
  endTime: number;
  guestName: string;
  guestEmail: string;
  title?: string;
  created: {
    bookingId?: string;
    bookingRef?: string;
    eventId?: string;
    title?: string;
  };
}) {
  const startAt = new Date(params.startTime * 1000);
  const endAt = new Date(params.endTime * 1000);
  const userId = await resolveGuestUserId(params.guestEmail);

  const data = {
    coachProfileId: params.coachProfileId,
    userId,
    nylasBookingId: params.created.bookingId ?? null,
    nylasBookingRef: params.created.bookingRef ?? null,
    nylasConfigId: params.configurationId,
    nylasEventId: params.created.eventId ?? null,
    guestName: params.guestName,
    guestEmail: params.guestEmail,
    title: params.created.title ?? params.title ?? null,
    startAt,
    endAt,
    status: CoachBookingStatus.CONFIRMED,
    rawPayload: params.created as object,
  };

  let bookingRowId: string | undefined;

  if (params.created.bookingId) {
    const existing = await prisma.coachBooking.findUnique({
      where: { nylasBookingId: params.created.bookingId },
    });
    if (existing) {
      const updated = await prisma.coachBooking.update({ where: { id: existing.id }, data });
      bookingRowId = updated.id;
    } else {
      const created = await prisma.coachBooking.create({ data });
      bookingRowId = created.id;
    }
  } else if (params.created.bookingRef) {
    const existing = await prisma.coachBooking.findUnique({
      where: { nylasBookingRef: params.created.bookingRef },
    });
    if (existing) {
      const updated = await prisma.coachBooking.update({ where: { id: existing.id }, data });
      bookingRowId = updated.id;
    } else {
      const created = await prisma.coachBooking.create({ data });
      bookingRowId = created.id;
    }
  } else {
    const created = await prisma.coachBooking.create({ data });
    bookingRowId = created.id;
  }

  return { startAt, endAt, bookingRowId, userId };
}

export async function sendNewBookingEmails(params: {
  coachProfileId: string;
  bookingId?: string | null;
  clientUserId?: string | null;
  coachName: string;
  coachEmail: string | null;
  guestName: string;
  guestEmail: string;
  title?: string | null;
  startAt: Date;
  endAt: Date;
  bookingRef?: string | null;
}) {
  const emailPayload = {
    coachProfileId: params.coachProfileId,
    bookingId: params.bookingId,
    clientUserId: params.clientUserId,
    guestEmail: params.guestEmail,
    guestName: params.guestName,
    coachName: params.coachName,
    title: params.title,
    startAt: params.startAt.toISOString(),
    endAt: params.endAt.toISOString(),
    bookingRef: params.bookingRef,
  };

  await sendBookingGuestConfirmationEmail(emailPayload).catch((err) =>
    console.error("[coach-booking] guest email", err),
  );

  if (params.coachEmail) {
    await sendBookingCoachNotificationEmail({
      ...emailPayload,
      coachEmail: params.coachEmail,
    }).catch((err) => console.error("[coach-booking] coach email", err));
  }
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
  /** When false, skip Resend emails (webhook path sends separately). Default true for API bookings. */
  sendEmails?: boolean;
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

  const { startAt, endAt, bookingRowId, userId } = await persistBookingRecord({
    coachProfileId: params.coachProfileId,
    configurationId: params.configurationId,
    startTime: params.startTime,
    endTime: params.endTime,
    guestName: params.guestName,
    guestEmail: params.guestEmail,
    title: params.title,
    created,
  });

  if (params.sendEmails !== false) {
    const coach = await prisma.coachProfile.findUnique({
      where: { id: params.coachProfileId },
      select: { displayName: true, email: true, nylasGrantEmail: true },
    });
    if (coach) {
      await sendNewBookingEmails({
        coachProfileId: params.coachProfileId,
        bookingId: bookingRowId,
        clientUserId: userId,
        coachName: coach.displayName,
        coachEmail: resolveCoachNotificationEmail(coach),
        guestName: params.guestName,
        guestEmail: params.guestEmail,
        title: created.title ?? params.title,
        startAt,
        endAt,
        bookingRef: created.bookingRef,
      });
    }
  }

  return {
    bookingId: created.bookingId,
    bookingRef: created.bookingRef,
    startAt,
    endAt,
    title: created.title ?? params.title,
    dbBookingId: bookingRowId,
  };
}
