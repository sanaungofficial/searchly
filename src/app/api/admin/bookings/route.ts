import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CoachBookingStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const coachId = sp.get("coachId") ?? undefined;
  const statusParam = sp.get("status") ?? undefined;
  const limit = Math.min(Number(sp.get("limit") ?? 100), 500);

  const status =
    statusParam && Object.values(CoachBookingStatus).includes(statusParam as CoachBookingStatus)
      ? (statusParam as CoachBookingStatus)
      : undefined;

  const bookings = await prisma.coachBooking.findMany({
    where: {
      ...(coachId ? { coachProfileId: coachId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { startAt: "desc" },
    take: limit,
    include: {
      coachProfile: {
        select: { id: true, displayName: true, slug: true, email: true },
      },
    },
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      coachProfileId: b.coachProfileId,
      coachProfileId: b.coachProfileId,
      coachName: b.coachProfile.displayName,
      coachSlug: b.coachProfile.slug,
      coachEmail: b.coachProfile.email,
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      title: b.title,
      location: b.location,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      status: b.status,
      nylasBookingRef: b.nylasBookingRef,
      createdAt: b.createdAt.toISOString(),
    })),
  });
}
