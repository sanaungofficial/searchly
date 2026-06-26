import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCoachClientSummaries,
  getCoachHubBookings,
  getCoachHubCommunications,
  getCoachHubStats,
} from "@/lib/coach-hub";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const coachId = sp.get("coachId");
  const clientUserId = sp.get("clientUserId") ?? undefined;
  const clientEmail = sp.get("clientEmail") ?? undefined;

  if (!coachId) {
    const coaches = await prisma.coachProfile.findMany({
      orderBy: [{ status: "asc" }, { featured: "desc" }, { displayName: "asc" }],
      select: {
        id: true,
        displayName: true,
        email: true,
        slug: true,
        photoUrl: true,
        headline: true,
        status: true,
        nylasGrantId: true,
        nylasSchedulerSlug: true,
      },
    });

    const rows = await Promise.all(
      coaches.map(async (coach) => ({
        ...coach,
        calendarConnected: Boolean(coach.nylasGrantId),
        stats: await getCoachHubStats(coach.id),
      })),
    );

    return NextResponse.json({ coaches: rows });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachId },
    select: {
      id: true,
      displayName: true,
      email: true,
      slug: true,
      photoUrl: true,
      headline: true,
      status: true,
      currentRole: true,
      currentCompany: true,
      location: true,
      nylasGrantId: true,
      nylasSchedulerSlug: true,
      nylasSchedulerConfigId: true,
      schedulerDurationMinutes: true,
    },
  });

  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const [stats, clients, communications, upcomingBookings, pastBookings] = await Promise.all([
    getCoachHubStats(coach.id),
    getCoachClientSummaries(coach.id),
    getCoachHubCommunications({
      coachProfileId: coach.id,
      clientUserId,
      clientEmail,
      limit: 40,
    }),
    getCoachHubBookings({
      coachProfileId: coach.id,
      clientUserId,
      clientEmail,
      upcoming: true,
      limit: 20,
    }),
    getCoachHubBookings({
      coachProfileId: coach.id,
      clientUserId,
      clientEmail,
      upcoming: false,
      limit: 20,
    }),
  ]);

  return NextResponse.json({
    coach: {
      ...coach,
      calendarConnected: Boolean(coach.nylasGrantId),
      schedulerReady: Boolean(coach.nylasGrantId && coach.nylasSchedulerConfigId),
    },
    stats,
    clients,
    communications,
    upcomingBookings,
    pastBookings,
  });
}
