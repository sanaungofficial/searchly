import { CoachBookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveCoachNotificationEmail } from "@/lib/coach-notification-email";
import {
  sendBookingRequestCoachNotificationEmail,
  sendBookingRequestGuestAckEmail,
} from "@/lib/comms/booking-request-emails";

export type BookingRequestPreferredTime = { startTime: number; endTime: number };

export type CreateCoachBookingRequestInput = {
  coachProfileId: string;
  coachDisplayName: string;
  coachEmail: string | null;
  userId: string;
  guestName: string;
  guestEmail: string;
  sessionType: "intro" | "session";
  preferredTimes: BookingRequestPreferredTime[];
  message?: string | null;
  timezone?: string | null;
};

export async function createCoachBookingRequest(input: CreateCoachBookingRequestInput) {
  const sorted = [...input.preferredTimes].sort((a, b) => a.startTime - b.startTime);
  const primary = sorted[0]!;
  const startAt = new Date(primary.startTime * 1000);
  const endAt = new Date(primary.endTime * 1000);
  const title =
    input.sessionType === "intro"
      ? `Intro call request with ${input.coachDisplayName}`
      : `Session request with ${input.coachDisplayName}`;

  const booking = await prisma.coachBooking.create({
    data: {
      coachProfileId: input.coachProfileId,
      userId: input.userId,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      title,
      startAt,
      endAt,
      status: CoachBookingStatus.PENDING,
      rawPayload: {
        kind: "booking_request",
        sessionType: input.sessionType,
        preferredTimes: sorted,
        message: input.message?.trim() || null,
        timezone: input.timezone ?? null,
      },
    },
  });

  const coachEmail = input.coachEmail;
  if (coachEmail) {
    await sendBookingRequestCoachNotificationEmail({
      coachProfileId: input.coachProfileId,
      bookingId: booking.id,
      clientUserId: input.userId,
      coachEmail,
      coachName: input.coachDisplayName,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      preferredTimes: sorted,
      sessionType: input.sessionType,
      message: input.message,
    }).catch((err) => console.error("[booking-request] coach email", err));
  }

  await sendBookingRequestGuestAckEmail({
    coachProfileId: input.coachProfileId,
    bookingId: booking.id,
    clientUserId: input.userId,
    guestEmail: input.guestEmail,
    guestName: input.guestName,
    coachName: input.coachDisplayName,
    preferredTimes: sorted,
    sessionType: input.sessionType,
  }).catch((err) => console.error("[booking-request] guest email", err));

  return booking;
}

export function resolveCoachBookingRequestEmail(coach: {
  email?: string | null;
  nylasGrantEmail?: string | null;
}): string | null {
  return resolveCoachNotificationEmail(coach);
}
