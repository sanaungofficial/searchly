import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isNylasConfigured, listCalendars } from "@/lib/nylas";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const profile = await prisma.coachProfile.findUnique({
    where: { id },
    select: { nylasGrantId: true, nylasSchedulerCalendarIds: true },
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
    console.error("[admin nylas/calendars]", err);
    return NextResponse.json({ error: "Could not load calendars" }, { status: 500 });
  }
}
