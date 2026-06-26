import { NextRequest, NextResponse } from "next/server";
import { CoachBookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendBookingCancelledEmail } from "@/lib/booking-emails";
import { cancelSchedulerBooking, rescheduleSchedulerBooking } from "@/lib/nylas";

async function findBookingByRef(bookingRef: string) {
  return prisma.coachBooking.findFirst({
    where: {
      OR: [{ nylasBookingRef: bookingRef }, { nylasBookingId: bookingRef }],
    },
    include: {
      coachProfile: {
        select: {
          id: true,
          displayName: true,
          nylasSchedulerConfigId: true,
          nylasIntroSchedulerConfigId: true,
        },
      },
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ bookingRef: string }> }) {
  const { bookingRef } = await params;

  const booking = await findBookingByRef(bookingRef);
  const configId =
    booking?.nylasConfigId ??
    booking?.coachProfile.nylasSchedulerConfigId ??
    booking?.coachProfile.nylasIntroSchedulerConfigId;

  if (!booking || !configId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    configurationId: configId,
    bookingRef: booking.nylasBookingRef ?? bookingRef,
    bookingId: booking.nylasBookingId,
    coachName: booking.coachProfile.displayName,
    title: booking.title,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    status: booking.status,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ bookingRef: string }> }) {
  const { bookingRef } = await params;
  const booking = await findBookingByRef(bookingRef);

  if (!booking?.nylasBookingId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const configId =
    booking.nylasConfigId ??
    booking.coachProfile.nylasSchedulerConfigId ??
    booking.coachProfile.nylasIntroSchedulerConfigId;
  if (!configId) {
    return NextResponse.json({ error: "Scheduling not configured" }, { status: 503 });
  }

  let body: { startTime?: number; endTime?: number };
  try {
    body = (await req.json()) as { startTime?: number; endTime?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const startTime = Number(body.startTime);
  const endTime = Number(body.endTime);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return NextResponse.json({ error: "Invalid start or end time" }, { status: 400 });
  }

  try {
    await rescheduleSchedulerBooking({
      bookingId: booking.nylasBookingId,
      configurationId: configId,
      startTime,
      endTime,
    });

    const startAt = new Date(startTime * 1000);
    const endAt = new Date(endTime * 1000);
    await prisma.coachBooking.update({
      where: { id: booking.id },
      data: {
        startAt,
        endAt,
        status: CoachBookingStatus.RESCHEDULED,
      },
    });

    return NextResponse.json({
      ok: true,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      status: CoachBookingStatus.RESCHEDULED,
    });
  } catch (err) {
    console.error("[bookings/ref] reschedule", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reschedule failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ bookingRef: string }> }) {
  const { bookingRef } = await params;
  const booking = await findBookingByRef(bookingRef);

  if (!booking?.nylasBookingId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const configId =
    booking.nylasConfigId ??
    booking.coachProfile.nylasSchedulerConfigId ??
    booking.coachProfile.nylasIntroSchedulerConfigId;
  if (!configId) {
    return NextResponse.json({ error: "Scheduling not configured" }, { status: 503 });
  }

  const reason = req.nextUrl.searchParams.get("reason") ?? undefined;

  try {
    await cancelSchedulerBooking({
      bookingId: booking.nylasBookingId,
      configurationId: configId,
      cancellationReason: reason ?? "Cancelled by guest",
    });

    await prisma.coachBooking.update({
      where: { id: booking.id },
      data: { status: CoachBookingStatus.CANCELLED },
    });

    if (booking.guestEmail) {
      sendBookingCancelledEmail({
        coachProfileId: booking.coachProfileId,
        bookingId: booking.id,
        clientUserId: booking.userId,
        guestEmail: booking.guestEmail,
        guestName: booking.guestName,
        coachName: booking.coachProfile.displayName,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
      }).catch((err) => console.error("[bookings/ref] cancel email", err));
    }

    return NextResponse.json({ ok: true, status: CoachBookingStatus.CANCELLED });
  } catch (err) {
    console.error("[bookings/ref] cancel", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cancellation failed" },
      { status: 500 },
    );
  }
}
