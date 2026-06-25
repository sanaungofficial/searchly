import { NextRequest, NextResponse } from "next/server";
import { CoachStatus, UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { coachProfileSlug } from "@/lib/coach-slug";
import { ensureCoachSchedulerConfig, isNylasConfigured } from "@/lib/nylas";

async function getCoachProfileForUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true, email: true, name: true },
  });
  if (!dbUser || (dbUser.role !== UserRole.COACH && dbUser.role !== UserRole.ADMIN)) return null;

  let profile = await prisma.coachProfile.findFirst({
    where: { OR: [{ userId: dbUser.id }, { email: dbUser.email }] },
  });
  if (!profile) return null;

  return { dbUser, profile };
}

export async function POST(_req: NextRequest) {
  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const ctx = await getCoachProfileForUser();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { profile, dbUser } = ctx;
  if (!profile.nylasGrantId) {
    return NextResponse.json({ error: "Calendar not connected — connect Google or Outlook first." }, { status: 400 });
  }

  const slug = profile.slug ?? coachProfileSlug(profile.displayName, profile.id);
  const coachEmail = profile.email ?? dbUser.email;

  try {
    const result = await ensureCoachSchedulerConfig({
      grantId: profile.nylasGrantId,
      configId: profile.nylasSchedulerConfigId,
      coachName: profile.displayName,
      coachEmail,
      slug: profile.nylasSchedulerSlug ?? `kimchi-${slug}`,
      durationMinutes: profile.schedulerDurationMinutes ?? 30,
    });

    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        nylasSchedulerConfigId: result.configId,
        ...(result.slug ? { nylasSchedulerSlug: result.slug } : {}),
        ...(dbUser.role === UserRole.ADMIN && profile.status !== CoachStatus.ACTIVE
          ? { status: CoachStatus.ACTIVE }
          : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      configurationId: result.configId,
    });
  } catch (err) {
    console.error("[nylas/retry-scheduler]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scheduler setup failed" },
      { status: 502 },
    );
  }
}
