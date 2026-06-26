import { NextRequest, NextResponse } from "next/server";
import { findCoachBySlugOrId, getClientCoachingUser } from "@/lib/coach-api";
import {
  fetchCoachAvailabilitySlots,
  findNextCoachSlot,
  INTRO_SESSION_MINUTES,
} from "@/lib/coach-booking-nylas";
import { prepareCoachSchedulerForAvailability } from "@/lib/coach-scheduler-sync";
import { isNylasConfigured } from "@/lib/nylas";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Scheduling not available" }, { status: 503 });
  }

  const me = await getClientCoachingUser(req);
  const coach = await findCoachBySlugOrId(slug, me?.id);
  if (!coach?.nylasSchedulerConfigId || !coach.nylasGrantId) {
    return NextResponse.json({ error: "Coach scheduling not configured" }, { status: 404 });
  }

  const configId = coach.nylasSchedulerConfigId;
  const sessionMinutes = coach.schedulerDurationMinutes ?? 60;
  const durationMinutes = Number(req.nextUrl.searchParams.get("durationMinutes")) || sessionMinutes;
  const nextOnly = req.nextUrl.searchParams.get("nextOnly") === "true";

  const now = Math.floor(Date.now() / 1000);
  const defaultEnd = now + 14 * 24 * 60 * 60;
  const startTime = Number(req.nextUrl.searchParams.get("startTime")) || now;
  const endTime = Number(req.nextUrl.searchParams.get("endTime")) || defaultEnd;

  try {
    await prepareCoachSchedulerForAvailability(coach, durationMinutes);

    if (nextOnly) {
      const nextSlot = await findNextCoachSlot({
        configurationId: configId,
      });
      return NextResponse.json({
        nextSlot,
        sessionDurationMinutes: sessionMinutes,
        introDurationMinutes: INTRO_SESSION_MINUTES,
        timezone: coach.schedulerTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    const slots = await fetchCoachAvailabilitySlots({
      configurationId: configId,
      startTime,
      endTime,
    });

    return NextResponse.json({
      slots,
      sessionDurationMinutes: sessionMinutes,
      introDurationMinutes: INTRO_SESSION_MINUTES,
      timezone: coach.schedulerTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load availability";
    console.error("[coaches availability]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
