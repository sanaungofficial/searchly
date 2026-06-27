import { NextResponse } from "next/server";
import type { LiveSessionFormat } from "@prisma/client";
import {
  createCoachLiveSession,
  listCoachOwnedSessions,
  listAdminLiveSessions,
  toLiveSessionView,
  updateLiveSession,
} from "@/lib/live-session-db";
import { requireCoachLiveAuth, normalizeCoHosts } from "@/lib/coach-live-auth";
import { liveSessionRouteId } from "@/lib/live-sessions";

function parseSchedule(body: {
  scheduledStart?: string;
  scheduledEnd?: string;
  durationMinutes?: number;
}) {
  if (!body.scheduledStart) return { error: "scheduledStart is required" };
  const scheduledStart = new Date(body.scheduledStart);
  if (Number.isNaN(scheduledStart.getTime())) return { error: "Invalid scheduledStart" };

  let scheduledEnd: Date;
  if (body.scheduledEnd) {
    scheduledEnd = new Date(body.scheduledEnd);
    if (Number.isNaN(scheduledEnd.getTime())) return { error: "Invalid scheduledEnd" };
  } else if (body.durationMinutes && body.durationMinutes > 0) {
    scheduledEnd = new Date(scheduledStart.getTime() + body.durationMinutes * 60_000);
  } else {
    return { error: "scheduledEnd or durationMinutes is required" };
  }

  if (scheduledEnd <= scheduledStart) return { error: "End time must be after start time" };
  return { scheduledStart, scheduledEnd };
}

export async function GET(request: Request) {
  const auth = await requireCoachLiveAuth(request);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = auth.isAdmin
    ? await listAdminLiveSessions()
    : await listCoachOwnedSessions(auth.coachProfileId);

  const sessions = rows.map((row) => ({
    ...toLiveSessionView(row),
    publicPath: `/live/${liveSessionRouteId(row)}`,
  }));

  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const auth = await requireCoachLiveAuth(request);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!auth.coachProfileId) {
    return NextResponse.json(
      { error: "Link a coach profile to your account before creating webinars." },
      { status: 403 },
    );
  }

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
    coHosts?: Array<{ coachProfileId?: string | null; displayName: string; email?: string | null }>;
    publish?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim() || !body.description?.trim()) {
    return NextResponse.json({ error: "title and description are required" }, { status: 400 });
  }

  const schedule = parseSchedule(body);
  if ("error" in schedule) {
    return NextResponse.json({ error: schedule.error }, { status: 400 });
  }

  const coHosts = normalizeCoHosts(body.coHosts);
  const status = body.publish ? "PENDING_APPROVAL" : "DRAFT";

  try {
    const row = await createCoachLiveSession({
      title: body.title,
      description: body.description,
      category: body.category,
      coachProfileId: auth.coachProfileId,
      scheduledStart: schedule.scheduledStart,
      scheduledEnd: schedule.scheduledEnd,
      timezone: body.timezone,
      format: body.format ?? "INTERACTIVE",
      coverImageUrl: body.coverImageUrl,
      coHosts,
      status,
    });

    if (body.publish) {
      await updateLiveSession(row.id, { submittedForApprovalAt: new Date() });
    }

    return NextResponse.json(
      {
        session: {
          ...toLiveSessionView(row),
          publicPath: `/live/${liveSessionRouteId(row)}`,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[coach/live/sessions POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create webinar" },
      { status: 400 },
    );
  }
}
