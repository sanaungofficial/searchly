import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { isCoachProfileOnboardingComplete } from "@/lib/coach-onboarding";

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
  const complete = Boolean(me.onboardingCompletedAt) || profileComplete;

  return NextResponse.json({
    complete,
    role: me.role,
    displayName: me.name ?? me.email.split("@")[0],
    avatarUrl: me.avatarUrl,
    profile: me.coachProfile,
    status: me.coachProfile?.status ?? null,
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
