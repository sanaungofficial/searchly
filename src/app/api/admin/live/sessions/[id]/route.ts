import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { findLiveSessionByRouteId, updateLiveSession } from "@/lib/live-session-db";
import type { LiveSessionStatus } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await findLiveSessionByRouteId(id);
  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
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
    status?: LiveSessionStatus;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scheduledStart = body.scheduledStart ? new Date(body.scheduledStart) : undefined;
  const scheduledEnd = body.scheduledEnd ? new Date(body.scheduledEnd) : undefined;
  if (scheduledStart && Number.isNaN(scheduledStart.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledStart" }, { status: 400 });
  }
  if (scheduledEnd && Number.isNaN(scheduledEnd.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledEnd" }, { status: 400 });
  }

  try {
    const row = await updateLiveSession(existing.id, {
      title: body.title,
      description: body.description,
      category: body.category,
      coachProfileId: body.coachProfileId,
      hostName: body.hostName,
      scheduledStart,
      scheduledEnd,
      isFeaturedWeekly: body.isFeaturedWeekly,
      bgColor: body.bgColor,
      accentColor: body.accentColor,
      status: body.status,
    });

    if (body.status === "CANCELLED" && existing.status !== "CANCELLED") {
      const { prisma } = await import("@/lib/prisma");
      const { sendLiveSessionCancelledEmail } = await import("@/lib/comms/live-session-emails");
      const registrations = await prisma.liveSessionRegistration.findMany({
        where: { liveSessionId: existing.id },
        include: { user: { select: { email: true, name: true } } },
      });
      for (const reg of registrations) {
        if (!reg.user.email) continue;
        void sendLiveSessionCancelledEmail({
          email: reg.user.email,
          name: reg.user.name,
          session: { title: row.title, host: row.hostName },
        }).catch((err) => console.error("[live/cancel email]", reg.id, err));
      }
    }

    return NextResponse.json({ session: row });
  } catch (err) {
    console.error("[admin/live/sessions PATCH]", err);
    return NextResponse.json({ error: "Could not update session" }, { status: 400 });
  }
}
