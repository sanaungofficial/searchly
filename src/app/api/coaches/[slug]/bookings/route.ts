import { NextRequest, NextResponse } from "next/server";
import { getClientCoachingUser, findCoachBySlugOrId } from "@/lib/coach-api";
import { createCoachBookingRecord } from "@/lib/coach-booking-nylas";
import {
  introDurationForCoach,
  resolveSchedulerConfigId,
  sessionDurationForCoach,
} from "@/lib/coach-scheduler-config";
import { isNylasConfigured } from "@/lib/nylas";

type BookBody = {
  startTime: number;
  endTime: number;
  sessionType?: "intro" | "session";
  guestName?: string;
  timezone?: string;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const me = await getClientCoachingUser(req);
  if (!me) return NextResponse.json({ error: "Sign in to book a session" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Scheduling not available" }, { status: 503 });
  }

  const { slug } = await params;
  const coach = await findCoachBySlugOrId(slug, me.id);
  if (!coach?.nylasGrantId) {
    return NextResponse.json({ error: "Coach scheduling not configured" }, { status: 404 });
  }

  if (coach.nylasGrantStatus === "expired") {
    return NextResponse.json({ error: "Coach calendar connection expired" }, { status: 503 });
  }

  let body: BookBody;
  try {
    body = (await req.json()) as BookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const startTime = Number(body.startTime);
  const endTime = Number(body.endTime);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return NextResponse.json({ error: "Invalid start or end time" }, { status: 400 });
  }

  const sessionMinutes = sessionDurationForCoach(coach);
  const introMinutes = introDurationForCoach(coach);
  const expectedDuration =
    body.sessionType === "intro" ? introMinutes : sessionMinutes;
  const actualDuration = Math.round((endTime - startTime) / 60);
  if (actualDuration !== expectedDuration) {
    return NextResponse.json(
      { error: `Slot duration must be ${expectedDuration} minutes` },
      { status: 400 },
    );
  }

  const configId = resolveSchedulerConfigId(coach, { sessionType: body.sessionType });
  if (!configId) {
    return NextResponse.json({ error: "Coach scheduling not configured" }, { status: 404 });
  }

  const guestName = (body.guestName?.trim() || me.name || me.email.split("@")[0]).slice(0, 120);
  const guestEmail = me.email;
  const title =
    body.sessionType === "intro"
      ? `Intro call with ${coach.displayName}`
      : `Coaching session with ${coach.displayName}`;

  try {
    const booking = await createCoachBookingRecord({
      coachProfileId: coach.id,
      configurationId: configId,
      startTime,
      endTime,
      guestName,
      guestEmail,
      title,
      timezone: body.timezone,
      sendEmails: true,
    });

    return NextResponse.json({
      ok: true,
      booking: {
        bookingRef: booking.bookingRef,
        startAt: booking.startAt.toISOString(),
        endAt: booking.endAt.toISOString(),
        title: booking.title,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed";
    console.error("[coaches bookings]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
