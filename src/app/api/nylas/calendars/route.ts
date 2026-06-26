import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { isNylasConfigured, listCalendars } from "@/lib/nylas";

export async function GET() {
  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true },
  });
  if (!dbUser || (dbUser.role !== UserRole.COACH && dbUser.role !== UserRole.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await prisma.coachProfile.findFirst({
    where: { OR: [{ userId: dbUser.id }, { email: user.email }] },
    select: { nylasGrantId: true, nylasGrantStatus: true, nylasSchedulerCalendarIds: true },
  });
  if (!profile?.nylasGrantId) {
    return NextResponse.json({ error: "Calendar not connected" }, { status: 404 });
  }

  try {
    const calendars = await listCalendars(profile.nylasGrantId);
    const selected = Array.isArray(profile.nylasSchedulerCalendarIds)
      ? (profile.nylasSchedulerCalendarIds as string[])
      : [];
    return NextResponse.json({
      calendars: calendars.map((c) => ({
        id: c.id,
        name: c.name ?? c.id,
        isPrimary: Boolean(c.is_primary),
        readOnly: Boolean(c.read_only),
      })),
      selectedCalendarIds: selected.length ? selected : calendars.filter((c) => c.is_primary).map((c) => c.id),
    });
  } catch (err) {
    console.error("[nylas/calendars]", err);
    return NextResponse.json({ error: "Could not load calendars" }, { status: 500 });
  }
}
