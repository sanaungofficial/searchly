import { NextRequest, NextResponse } from "next/server";
import { CoachBookingStatus, UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

async function getCoachProfileForUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true, email: true },
  });
  if (!dbUser || (dbUser.role !== UserRole.COACH && dbUser.role !== UserRole.ADMIN)) return null;

  const profile = await prisma.coachProfile.findFirst({
    where: { OR: [{ userId: dbUser.id }, { email: dbUser.email }] },
    select: { id: true },
  });
  if (!profile) return null;

  return profile.id;
}

export async function GET(req: NextRequest) {
  const coachProfileId = await getCoachProfileForUser();
  if (!coachProfileId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const upcoming = sp.get("upcoming") !== "false";
  const limit = Math.min(Number(sp.get("limit") ?? 50), 200);

  const now = new Date();
  const bookings = await prisma.coachBooking.findMany({
    where: {
      coachProfileId,
      ...(upcoming
        ? {
            startAt: { gte: now },
            status: { in: [CoachBookingStatus.CONFIRMED, CoachBookingStatus.PENDING, CoachBookingStatus.RESCHEDULED] },
          }
        : { startAt: { lt: now } }),
    },
    orderBy: { startAt: upcoming ? "asc" : "desc" },
    take: limit,
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      coachProfileId: b.coachProfileId,
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
