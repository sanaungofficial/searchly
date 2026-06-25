import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ bookingRef: string }> }) {
  const { bookingRef } = await params;

  const booking = await prisma.coachBooking.findFirst({
    where: {
      OR: [{ nylasBookingRef: bookingRef }, { nylasBookingId: bookingRef }],
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      status: true,
      nylasBookingRef: true,
      coachProfile: {
        select: {
          displayName: true,
          nylasSchedulerConfigId: true,
        },
      },
    },
  });

  if (!booking?.coachProfile.nylasSchedulerConfigId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    configurationId: booking.coachProfile.nylasSchedulerConfigId,
    bookingRef: booking.nylasBookingRef ?? bookingRef,
    coachName: booking.coachProfile.displayName,
    title: booking.title,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    status: booking.status,
  });
}
