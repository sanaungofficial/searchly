import { prisma } from "@/lib/prisma";
import { CoachBookingStatus } from "@prisma/client";
import {
  sendBookingReminderEmail,
} from "@/lib/comms/booking-emails";

const HOUR_MS = 60 * 60 * 1000;
const TOLERANCE_MS = 10 * 60 * 1000;

export type BookingReminderCronSummary = {
  reminders24h: number;
  reminders1h: number;
  errors: string[];
};

async function sendWindowReminders(input: {
  window: "24h" | "1h";
  now: Date;
  summary: BookingReminderCronSummary;
}) {
  const offset = input.window === "24h" ? 24 * HOUR_MS : HOUR_MS;
  const start = new Date(input.now.getTime() + offset - TOLERANCE_MS);
  const end = new Date(input.now.getTime() + offset + TOLERANCE_MS);

  const flagField = input.window === "24h" ? "reminder24hSentAt" : "reminder1hSentAt";

  const bookings = await prisma.coachBooking.findMany({
    where: {
      status: { in: [CoachBookingStatus.CONFIRMED, CoachBookingStatus.PENDING, CoachBookingStatus.RESCHEDULED] },
      guestEmail: { not: null },
      startAt: { gte: start, lte: end },
      [flagField]: null,
    },
    include: {
      coachProfile: { select: { displayName: true } },
    },
    take: 50,
  });

  for (const booking of bookings) {
    if (!booking.guestEmail) continue;
    try {
      await sendBookingReminderEmail({
        coachProfileId: booking.coachProfileId,
        bookingId: booking.id,
        clientUserId: booking.userId,
        guestEmail: booking.guestEmail,
        guestName: booking.guestName,
        coachName: booking.coachProfile.displayName,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        window: input.window,
      });
      await prisma.coachBooking.update({
        where: { id: booking.id },
        data: { [flagField]: input.now },
      });
      if (input.window === "24h") input.summary.reminders24h += 1;
      else input.summary.reminders1h += 1;
    } catch (err) {
      input.summary.errors.push(
        `${booking.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export async function runBookingReminderCron(): Promise<BookingReminderCronSummary> {
  const summary: BookingReminderCronSummary = { reminders24h: 0, reminders1h: 0, errors: [] };
  const now = new Date();
  await sendWindowReminders({ window: "24h", now, summary });
  await sendWindowReminders({ window: "1h", now, summary });
  return summary;
}
