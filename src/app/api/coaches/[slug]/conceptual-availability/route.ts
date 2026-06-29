import { NextRequest, NextResponse } from "next/server";
import { findCoachBySlugOrId, getClientCoachingUser } from "@/lib/coach-api";
import { generateConceptualAvailabilitySlots } from "@/lib/coach-availability-display";
import { introDurationForCoach, sessionDurationForCoach } from "@/lib/coach-scheduler-config";
import { isNylasConfigured } from "@/lib/nylas";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getClientCoachingUser(req);
  const coach = await findCoachBySlugOrId(slug, me?.id);
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const hasDirectBooking = Boolean(coach.nylasSchedulerConfigId && isNylasConfigured());
  if (hasDirectBooking) {
    return NextResponse.json({ error: "Use live availability for this coach" }, { status: 409 });
  }

  const durationMinutes =
    Number(req.nextUrl.searchParams.get("durationMinutes")) ||
    sessionDurationForCoach(coach);
  const introMinutes = introDurationForCoach(coach);
  const startTime = Number(req.nextUrl.searchParams.get("startTime"));
  const endTime = Number(req.nextUrl.searchParams.get("endTime"));

  const startDate = Number.isFinite(startTime) ? new Date(startTime * 1000) : new Date();
  const daySpan =
    Number.isFinite(startTime) && Number.isFinite(endTime)
      ? Math.max(1, Math.ceil((endTime - startTime) / (24 * 60 * 60)))
      : 7;

  const slots = generateConceptualAvailabilitySlots(coach, {
    startDate,
    days: daySpan,
    durationMinutes: durationMinutes === introMinutes ? introMinutes : durationMinutes,
  }).filter((slot) => {
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return true;
    return slot.startTime >= startTime && slot.startTime < endTime;
  });

  return NextResponse.json({
    slots,
    introDurationMinutes: introMinutes,
    sessionDurationMinutes: sessionDurationForCoach(coach),
    timezone: coach.schedulerTimezone ?? "America/New_York",
  });
}
