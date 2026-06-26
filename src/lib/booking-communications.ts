import {
  CoachBookingCommAudience,
  CoachBookingCommType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveGuestUserId } from "@/lib/coach-hub";

export async function logBookingCommunication(params: {
  bookingId?: string | null;
  coachProfileId: string;
  clientUserId?: string | null;
  guestEmail?: string | null;
  type: CoachBookingCommType;
  audience: CoachBookingCommAudience;
  recipientEmail: string;
  subject: string;
  bodyPreview?: string | null;
}) {
  let clientUserId = params.clientUserId ?? null;
  if (!clientUserId && params.guestEmail) {
    clientUserId = await resolveGuestUserId(params.guestEmail);
  }

  return prisma.coachBookingCommunication.create({
    data: {
      bookingId: params.bookingId ?? null,
      coachProfileId: params.coachProfileId,
      clientUserId,
      type: params.type,
      audience: params.audience,
      recipientEmail: params.recipientEmail,
      subject: params.subject,
      bodyPreview: params.bodyPreview ?? null,
    },
  });
}
