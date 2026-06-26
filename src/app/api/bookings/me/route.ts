import { NextRequest, NextResponse } from "next/server";
import { CoachBookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientCoachingUser } from "@/lib/coach-api";

export async function GET(req: NextRequest) {
  const me = await getClientCoachingUser(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const upcoming = sp.get("upcoming") !== "false";
  const limit = Math.min(Number(sp.get("limit") ?? 20), 100);

  const now = new Date();
  const bookings = await prisma.coachBooking.findMany({
    where: {
      OR: [{ userId: me.id }, { guestEmail: { equals: me.email, mode: "insensitive" } }],
      ...(upcoming
        ? {
            startAt: { gte: now },
            status: { in: [CoachBookingStatus.CONFIRMED, CoachBookingStatus.PENDING, CoachBookingStatus.RESCHEDULED] },
          }
        : { startAt: { lt: now } }),
    },
    orderBy: { startAt: upcoming ? "asc" : "desc" },
    take: limit,
    include: {
      coachProfile: {
        select: { id: true, displayName: true, slug: true, photoUrl: true, nylasSchedulerConfigId: true },
      },
    },
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      coachProfileId: b.coachProfileId,
      coachName: b.coachProfile.displayName,
      coachSlug: b.coachProfile.slug,
      coachPhotoUrl: b.coachProfile.photoUrl,
      configurationId: b.coachProfile.nylasSchedulerConfigId,
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      title: b.title,
      location: b.location,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      status: b.status,
      nylasBookingRef: b.nylasBookingRef,
    })),
  });
}
