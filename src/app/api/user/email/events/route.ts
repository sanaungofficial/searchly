import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { fetchUpcomingEvents, formatMessageDate } from "@/lib/nylas-inbox";
import { isNylasConfigured } from "@/lib/nylas";
import { getUserEmailGrant } from "@/lib/user-email-server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getUserEmailGrant(dbUser.id);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  try {
    const events = await fetchUpcomingEvents(grant.nylasGrantId, 28);
    const eventIds = events.map((e) => e.id);
    const activities = eventIds.length
      ? await prisma.jobActivityLog.findMany({
          where: { userId: dbUser.id, nylasEventId: { in: eventIds } },
          include: { job: { select: { id: true, company: true, role: true, stage: true } } },
        })
      : [];

    const activityByEventId = Object.fromEntries(
      activities.filter((a) => a.nylasEventId).map((a) => [a.nylasEventId!, a]),
    );

    return NextResponse.json({
      events: events.map((ev) => {
        const start = ev.when?.start_time ? new Date(ev.when.start_time * 1000) : null;
        const activity = activityByEventId[ev.id];
        return {
          id: ev.id,
          title: ev.title ?? "Calendar event",
          location: ev.location ?? null,
          startAt: start?.toISOString() ?? null,
          startLabel: start ? formatMessageDate(ev.when?.start_time) : "",
          activity: activity
            ? {
                id: activity.id,
                signal: activity.signal,
                status: activity.status,
                suggestedStage: activity.suggestedStage,
                job: activity.job,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    console.error("[user/email/events]", err);
    return NextResponse.json({ error: "Could not load calendar" }, { status: 500 });
  }
}
