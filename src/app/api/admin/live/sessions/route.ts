import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createLiveSession } from "@/lib/live-session-db";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const coaches = await prisma.coachProfile.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, displayName: true, headline: true, slug: true },
    orderBy: { displayName: "asc" },
  });

  return NextResponse.json({ coaches });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    title?: string;
    description?: string;
    category?: string;
    coachProfileId?: string | null;
    hostName?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    isFeaturedWeekly?: boolean;
    bgColor?: string;
    accentColor?: string;
    status?: "DRAFT" | "SCHEDULED";
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim() || !body.description?.trim()) {
    return NextResponse.json({ error: "title and description are required" }, { status: 400 });
  }
  if (!body.scheduledStart || !body.scheduledEnd) {
    return NextResponse.json({ error: "scheduledStart and scheduledEnd are required" }, { status: 400 });
  }

  const scheduledStart = new Date(body.scheduledStart);
  const scheduledEnd = new Date(body.scheduledEnd);
  if (Number.isNaN(scheduledStart.getTime()) || Number.isNaN(scheduledEnd.getTime())) {
    return NextResponse.json({ error: "Invalid schedule dates" }, { status: 400 });
  }
  if (scheduledEnd <= scheduledStart) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  try {
    const row = await createLiveSession({
      title: body.title,
      description: body.description,
      category: body.category,
      coachProfileId: body.coachProfileId ?? null,
      hostName: body.hostName,
      scheduledStart,
      scheduledEnd,
      isFeaturedWeekly: body.isFeaturedWeekly,
      bgColor: body.bgColor,
      accentColor: body.accentColor,
      status: body.status ?? "SCHEDULED",
    });

    return NextResponse.json({ session: row }, { status: 201 });
  } catch (err) {
    console.error("[admin/live/sessions POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create session" },
      { status: 400 }
    );
  }
}
