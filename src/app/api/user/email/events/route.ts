import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { fetchUpcomingEvents, formatMessageDate } from "@/lib/nylas-inbox";
import { logInboxEvent } from "@/lib/inbox-crm/log-event";
import { isNylasConfigured } from "@/lib/nylas";
import { getUserEmailGrant } from "@/lib/user-email-server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getUserEmailGrant(dbUser.id);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  try {
    const events = await fetchUpcomingEvents(grant.nylasGrantId, 28);

    await Promise.all(
      events.slice(0, 20).map(async (ev) => {
        const existing = await prisma.inboxActivity.findUnique({
          where: { userId_nylasEventId: { userId: dbUser.id, nylasEventId: ev.id } },
          select: { id: true },
        });
        if (!existing) {
          await logInboxEvent({
            userId: dbUser.id,
            grantId: grant.nylasGrantId,
            userEmail: grant.email,
            event: ev,
          }).catch(() => null);
        }
      }),
    );

    const eventIds = events.map((e) => e.id);
    const activities = eventIds.length
      ? await prisma.inboxActivity.findMany({
          where: { userId: dbUser.id, nylasEventId: { in: eventIds } },
          include: {
            job: { select: { id: true, company: true, role: true, stage: true } },
            contact: { select: { id: true, email: true, name: true, company: true } },
          },
        })
      : [];

    const activityByEventId = Object.fromEntries(
      activities.filter((a) => a.nylasEventId).map((a) => [a.nylasEventId!, a]),
    );

    return NextResponse.json({
      events: events.map((ev) => {
        const start = ev.when?.start_time ? new Date(ev.when.start_time * 1000) : null;
        const end = ev.when?.end_time ? new Date(ev.when.end_time * 1000) : null;
        const activity = activityByEventId[ev.id];
        const participants = (ev.participants ?? [])
          .map((p) => p.name?.trim() || p.email?.trim())
          .filter(Boolean)
          .slice(0, 4);
        return {
          id: ev.id,
          title: ev.title ?? "Calendar event",
          location: ev.location ?? null,
          startAt: start?.toISOString() ?? null,
          endAt: end?.toISOString() ?? null,
          startLabel: start ? formatMessageDate(ev.when?.start_time) : "",
          participants,
          activity: activity
            ? {
                id: activity.id,
                category: activity.category,
                direction: activity.direction,
                userTag: activity.userTag,
                job: activity.job,
                contact: activity.contact,
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
