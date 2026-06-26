import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  getCoachClientSummaries,
  getCoachHubBookings,
  getCoachHubCommunications,
  getCoachHubStats,
  getCoachProfileForUser,
} from "@/lib/coach-hub";

async function getDbUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return prisma.user.findUnique({ where: { email: user.email } });
}

export async function GET(req: NextRequest) {
  const me = await getDbUser();
  if (!me || (me.role !== UserRole.COACH && me.role !== UserRole.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const coach =
    me.role === UserRole.ADMIN
      ? await prisma.coachProfile.findFirst({
          where: { userId: me.id },
          select: { id: true, displayName: true, slug: true, email: true, photoUrl: true, headline: true, nylasGrantId: true, status: true, nylasSchedulerSlug: true, nylasSchedulerConfigId: true, schedulerDurationMinutes: true },
        })
      : await getCoachProfileForUser(me.id, me.role);

  if (!coach && me.role === UserRole.COACH) {
    return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const coachIdParam = sp.get("coachId");
  const coachId = coachIdParam && me.role === UserRole.ADMIN ? coachIdParam : coach?.id;

  if (!coachId) {
    return NextResponse.json({ error: "Coach profile required" }, { status: 404 });
  }

  const profile = await prisma.coachProfile.findUnique({
    where: { id: coachId },
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
      nylasSchedulerConfigId: true,
      schedulerDurationMinutes: true,
      schedulerTimezone: true,
      schedulerOpenHourStart: true,
      schedulerOpenHourEnd: true,
      schedulerOpenDays: true,
    },
  });

  if (!profile) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const clientUserId = sp.get("clientUserId") ?? undefined;
  const clientEmail = sp.get("clientEmail") ?? undefined;

  const [stats, clients, communications, upcomingBookings, pastBookings] = await Promise.all([
    getCoachHubStats(profile.id),
    getCoachClientSummaries(profile.id),
    getCoachHubCommunications({
      coachProfileId: profile.id,
      clientUserId,
      clientEmail,
      limit: 40,
    }),
    getCoachHubBookings({
      coachProfileId: profile.id,
      clientUserId,
      clientEmail,
      upcoming: true,
      limit: 20,
    }),
    getCoachHubBookings({
      coachProfileId: profile.id,
      clientUserId,
      clientEmail,
      upcoming: false,
      limit: 20,
    }),
  ]);

  return NextResponse.json({
    coach: {
      ...profile,
      calendarConnected: Boolean(profile.nylasGrantId),
    },
    stats,
    clients,
    communications,
    upcomingBookings,
    pastBookings,
  });
}
