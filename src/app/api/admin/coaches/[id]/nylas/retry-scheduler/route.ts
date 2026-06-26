import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { syncCoachSchedulerFromProfile } from "@/lib/coach-scheduler-sync";
import { prisma } from "@/lib/prisma";
import { coachProfileSlug } from "@/lib/coach-slug";
import { isNylasConfigured } from "@/lib/nylas";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const profile = await prisma.coachProfile.findUnique({ where: { id } });
  if (!profile) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  if (!profile.nylasGrantId) {
    return NextResponse.json(
      { error: "Calendar not connected — connect Google or Outlook first." },
      { status: 400 },
    );
  }

  const slug = profile.slug ?? coachProfileSlug(profile.displayName, profile.id);

  try {
    const result = await syncCoachSchedulerFromProfile(profile.id);
    if (!result) {
      return NextResponse.json({ error: "Scheduler sync failed" }, { status: 502 });
    }

    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        ...(profile.status !== CoachStatus.ACTIVE ? { status: CoachStatus.ACTIVE } : {}),
        ...(slug !== profile.slug ? { slug } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      configurationId: result.configId,
    });
  } catch (err) {
    console.error("[admin coaches nylas retry-scheduler]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scheduler setup failed" },
      { status: 502 },
    );
  }
}
