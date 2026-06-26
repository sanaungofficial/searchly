import { NextRequest, NextResponse } from "next/server";
import { findCoachBySlugOrId, getClientCoachingUser } from "@/lib/coach-api";
import { filterSlotsByWeeklyCapacity } from "@/lib/coach-booking-capacity";
import {
  fetchCoachAvailabilitySlots,
  findNextCoachSlot,
} from "@/lib/coach-booking-nylas";
import {
  introDurationForCoach,
  resolveSchedulerConfigId,
  sessionDurationForCoach,
} from "@/lib/coach-scheduler-config";
import { isNylasConfigured } from "@/lib/nylas";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Scheduling not available" }, { status: 503 });
  }

  const me = await getClientCoachingUser(req);
  const coach = await findCoachBySlugOrId(slug, me?.id);
  if (!coach?.nylasGrantId) {
    return NextResponse.json({ error: "Coach scheduling not configured" }, { status: 404 });
  }

  if (coach.nylasGrantStatus === "expired") {
    return NextResponse.json({ error: "Coach calendar connection expired" }, { status: 503 });
  }

  const sessionMinutes = sessionDurationForCoach(coach);
  const introMinutes = introDurationForCoach(coach);
  const durationMinutes = Number(req.nextUrl.searchParams.get("durationMinutes")) || sessionMinutes;
  const configId = resolveSchedulerConfigId(coach, { durationMinutes });

  if (!configId) {
    return NextResponse.json({ error: "Coach scheduling not configured" }, { status: 404 });
  }

  const nextOnly = req.nextUrl.searchParams.get("nextOnly") === "true";

  const now = Math.floor(Date.now() / 1000);
  const defaultEnd = now + 14 * 24 * 60 * 60;
  const startTime = Number(req.nextUrl.searchParams.get("startTime")) || now;
  const endTime = Number(req.nextUrl.searchParams.get("endTime")) || defaultEnd;

  try {
    if (nextOnly) {
      const nextSlot = await findNextCoachSlot({ configurationId: configId });
      return NextResponse.json({
        nextSlot,
        sessionDurationMinutes: sessionMinutes,
        introDurationMinutes: introMinutes,
        timezone: coach.schedulerTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    let slots = await fetchCoachAvailabilitySlots({
      configurationId: configId,
      startTime,
      endTime,
    });

    slots = await filterSlotsByWeeklyCapacity({
      coachProfileId: coach.id,
      slots,
      capacityHoursPerWeek: coach.schedulerCapacityHoursPerWeek,
      timezone: coach.schedulerTimezone,
    });

    return NextResponse.json({
      slots,
      sessionDurationMinutes: sessionMinutes,
      introDurationMinutes: introMinutes,
      timezone: coach.schedulerTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load availability";
    console.error("[coaches availability]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
