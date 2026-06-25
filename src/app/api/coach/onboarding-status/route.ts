import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { coachOnboardingPhase, isCoachProfileOnboardingComplete } from "@/lib/coach-onboarding";

async function getStaffUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return prisma.user.findUnique({
    where: { email: user.email },
    select: {
      id: true,
      role: true,
      email: true,
      name: true,
      avatarUrl: true,
      onboardingCompletedAt: true,
      coachProfile: true,
    },
  });
}

export async function GET() {
  const me = await getStaffUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== UserRole.COACH && me.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profileComplete = isCoachProfileOnboardingComplete(me.coachProfile);
  const questionnaireComplete = Boolean(me.onboardingCompletedAt) || profileComplete;
  const profileStatus = me.coachProfile?.status ?? null;
  const phase = coachOnboardingPhase({ questionnaireComplete, profileStatus });

  let vouchCount = 0;
  if (me.coachProfile?.id) {
    vouchCount = await prisma.coachVouch.count({ where: { coachProfileId: me.coachProfile.id } });
  }

  return NextResponse.json({
    complete: questionnaireComplete,
    phase,
    role: me.role,
    displayName: me.name ?? me.email.split("@")[0],
    avatarUrl: me.avatarUrl,
    profile: me.coachProfile,
    status: profileStatus,
    vouchCount,
    coachProfileId: me.coachProfile?.id ?? null,
  });
}

export async function POST(req: NextRequest) {
  const me = await getStaffUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== UserRole.COACH && me.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.complete) {
    await prisma.user.update({
      where: { id: me.id },
      data: { onboardingCompletedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
