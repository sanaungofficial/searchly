import { NextRequest, NextResponse } from "next/server";
import { getClientCoachingUser, findCoachBySlugOrId } from "@/lib/coach-api";
import { isCoachAssignedToUser } from "@/lib/coach-client-assignment";
import {
  createCoachBookingRequest,
  resolveCoachBookingRequestEmail,
  type BookingRequestPreferredTime,
} from "@/lib/coach-booking-request";
import { introDurationForCoach, sessionDurationForCoach } from "@/lib/coach-scheduler-config";
import { isNylasConfigured } from "@/lib/nylas";

type RequestBody = {
  sessionType?: "intro" | "session";
  preferredTimes?: BookingRequestPreferredTime[];
  message?: string;
  guestName?: string;
  timezone?: string;
};

const MAX_PREFERRED_TIMES = 3;
const MAX_MESSAGE_LENGTH = 2000;

function isValidPreferredTime(slot: BookingRequestPreferredTime): boolean {
  return (
    Number.isFinite(slot.startTime) &&
    Number.isFinite(slot.endTime) &&
    slot.endTime > slot.startTime &&
    slot.startTime > Math.floor(Date.now() / 1000)
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const me = await getClientCoachingUser(req);
  if (!me) return NextResponse.json({ error: "Sign in to request a session" }, { status: 401 });

  const { slug } = await params;
  const coach = await findCoachBySlugOrId(slug, me.id);
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  if (coach.requiresAssignment) {
    const assigned = await isCoachAssignedToUser(coach.id, me.id);
    if (!assigned) {
      return NextResponse.json({ error: "Contact your Second Ladder team to get assigned to this coach." }, { status: 403 });
    }
  }

  const hasDirectBooking = Boolean(coach.nylasSchedulerConfigId && isNylasConfigured());
  if (hasDirectBooking) {
    return NextResponse.json({ error: "This coach accepts direct bookings — use the booking calendar." }, { status: 409 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionType = body.sessionType === "session" ? "session" : body.sessionType === "intro" ? "intro" : null;
  if (!sessionType) {
    return NextResponse.json({ error: "sessionType must be intro or session" }, { status: 400 });
  }

  const preferredTimes = Array.isArray(body.preferredTimes) ? body.preferredTimes.slice(0, MAX_PREFERRED_TIMES) : [];
  if (!preferredTimes.length || !preferredTimes.every(isValidPreferredTime)) {
    return NextResponse.json({ error: "Pick at least one valid preferred time" }, { status: 400 });
  }

  const expectedMinutes =
    sessionType === "intro" ? introDurationForCoach(coach) : sessionDurationForCoach(coach);
  for (const slot of preferredTimes) {
    const actualMinutes = Math.round((slot.endTime - slot.startTime) / 60);
    if (actualMinutes !== expectedMinutes) {
      return NextResponse.json({ error: `Each time must be ${expectedMinutes} minutes` }, { status: 400 });
    }
  }

  const guestName = (body.guestName?.trim() || me.name || me.email.split("@")[0]).slice(0, 120);
  const guestEmail = me.email;
  const message = body.message?.trim().slice(0, MAX_MESSAGE_LENGTH) || null;
  const timezone = body.timezone?.trim().slice(0, 80) || null;

  try {
    const booking = await createCoachBookingRequest({
      coachProfileId: coach.id,
      coachDisplayName: coach.displayName,
      coachEmail: resolveCoachBookingRequestEmail(coach),
      userId: me.id,
      guestName,
      guestEmail,
      sessionType,
      preferredTimes,
      message,
      timezone,
    });

    return NextResponse.json({
      ok: true,
      request: {
        id: booking.id,
        status: booking.status,
        sessionType,
        preferredTimes,
      },
    });
  } catch (err) {
    console.error("[coaches booking-requests]", err);
    return NextResponse.json({ error: "Could not submit request" }, { status: 500 });
  }
}
