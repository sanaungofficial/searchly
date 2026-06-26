import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCoachHubCommunications, resolveGuestUserId } from "@/lib/coach-hub";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { bookingId } = await params;
  const booking = await prisma.coachBooking.findUnique({
    where: { id: bookingId },
    include: {
      coachProfile: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          email: true,
          photoUrl: true,
          isInternal: true,
        },
      },
      user: { select: { id: true, email: true, name: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const guestUserId =
    booking.userId ?? (await resolveGuestUserId(booking.guestEmail));

  const communications = await getCoachHubCommunications({
    coachProfileId: booking.coachProfileId,
    clientUserId: guestUserId ?? undefined,
    clientEmail: booking.guestEmail ?? undefined,
    limit: 20,
  });

  return NextResponse.json({
    booking: {
      id: booking.id,
      coachProfileId: booking.coachProfileId,
      coachName: booking.coachProfile.displayName,
      coachSlug: booking.coachProfile.slug,
      coachEmail: booking.coachProfile.email,
      coachPhotoUrl: booking.coachProfile.photoUrl,
      coachIsInternal: booking.coachProfile.isInternal,
      userId: guestUserId,
      guestName: booking.guestName ?? booking.user?.name ?? null,
      guestEmail: booking.guestEmail ?? booking.user?.email ?? null,
      title: booking.title,
      location: booking.location,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      status: booking.status,
      nylasBookingRef: booking.nylasBookingRef,
      nylasBookingId: booking.nylasBookingId,
      nylasEventId: booking.nylasEventId,
      createdAt: booking.createdAt.toISOString(),
      durationMinutes: Math.round((booking.endAt.getTime() - booking.startAt.getTime()) / 60000),
    },
    communications,
  });
}
