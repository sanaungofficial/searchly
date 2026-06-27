import { NextResponse } from "next/server";
import type { LiveSessionFormat } from "@prisma/client";
import {
  findLiveSessionByRouteId,
  listSessionRegistrations,
  toLiveSessionView,
  updateLiveSession,
} from "@/lib/live-session-db";
import {
  getCoachOwnedSession,
  normalizeCoHosts,
  requireCoachLiveAuth,
} from "@/lib/coach-live-auth";
import { liveSessionRouteId } from "@/lib/live-sessions";

const EDITABLE_STATUSES = new Set(["DRAFT", "PENDING_APPROVAL", "SCHEDULED"]);

function parseSchedule(body: {
  scheduledStart?: string;
  scheduledEnd?: string;
  durationMinutes?: number;
}) {
  if (!body.scheduledStart) return null;
  const scheduledStart = new Date(body.scheduledStart);
  if (Number.isNaN(scheduledStart.getTime())) return { error: "Invalid scheduledStart" as const };

  let scheduledEnd: Date;
  if (body.scheduledEnd) {
    scheduledEnd = new Date(body.scheduledEnd);
    if (Number.isNaN(scheduledEnd.getTime())) return { error: "Invalid scheduledEnd" as const };
  } else if (body.durationMinutes && body.durationMinutes > 0) {
    scheduledEnd = new Date(scheduledStart.getTime() + body.durationMinutes * 60_000);
  } else {
    return null;
  }

  if (scheduledEnd <= scheduledStart) return { error: "End time must be after start time" as const };
  return { scheduledStart, scheduledEnd };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCoachLiveAuth(request);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const row = await getCoachOwnedSession(id, auth.coachProfileId, auth.isAdmin);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const registrations = await listSessionRegistrations(row.id);

  return NextResponse.json({
    session: {
      ...toLiveSessionView(row),
      publicPath: `/live/${liveSessionRouteId(row)}`,
    },
    registrations: registrations.map((r) => ({
      id: r.id,
      name: r.user.name,
      email: r.user.email,
      registeredAt: r.createdAt.toISOString(),
      joinedAt: r.joinedAt?.toISOString() ?? null,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCoachLiveAuth(request);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await getCoachOwnedSession(id, auth.coachProfileId, auth.isAdmin);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    title?: string;
    description?: string;
    category?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    durationMinutes?: number;
    timezone?: string;
    format?: LiveSessionFormat;
    coverImageUrl?: string | null;
    replayEnabled?: boolean;
    coHosts?: Array<{ coachProfileId?: string | null; displayName: string; email?: string | null }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.replayEnabled != null && existing.status === "ENDED") {
    const row = await updateLiveSession(existing.id, { replayEnabled: body.replayEnabled });
    return NextResponse.json({
      session: { ...toLiveSessionView(row), publicPath: `/live/${liveSessionRouteId(row)}` },
    });
  }

  if (!EDITABLE_STATUSES.has(existing.status)) {
    return NextResponse.json({ error: "This webinar can no longer be edited" }, { status: 409 });
  }

  const schedule = body.scheduledStart ? parseSchedule(body) : null;
  if (schedule && "error" in schedule) {
    return NextResponse.json({ error: schedule.error }, { status: 400 });
  }

  try {
    const row = await updateLiveSession(existing.id, {
      title: body.title,
      description: body.description,
      category: body.category,
      timezone: body.timezone,
      format: body.format,
      coverImageUrl: body.coverImageUrl,
      ...(schedule && !("error" in schedule)
        ? { scheduledStart: schedule.scheduledStart, scheduledEnd: schedule.scheduledEnd }
        : {}),
      ...(body.coHosts ? { coHosts: normalizeCoHosts(body.coHosts) } : {}),
    });

    return NextResponse.json({
      session: { ...toLiveSessionView(row), publicPath: `/live/${liveSessionRouteId(row)}` },
    });
  } catch (err) {
    console.error("[coach/live/sessions PATCH]", err);
    return NextResponse.json({ error: "Could not update webinar" }, { status: 400 });
  }
}
