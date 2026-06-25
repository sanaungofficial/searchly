import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { coachVouchUrl } from "@/lib/coach-onboarding";

async function getCoachProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { role: true, coachProfile: { select: { id: true, displayName: true } } },
  });
  if (!dbUser || (dbUser.role !== UserRole.COACH && dbUser.role !== UserRole.ADMIN)) return null;
  return dbUser.coachProfile;
}

export async function GET() {
  const profile = await getCoachProfile();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [vouches, count] = await Promise.all([
    prisma.coachVouch.findMany({
      where: { coachProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        authorName: true,
        relationship: true,
        message: true,
        createdAt: true,
      },
    }),
    prisma.coachVouch.count({ where: { coachProfileId: profile.id } }),
  ]);

  return NextResponse.json({
    count,
    vouches,
    vouchUrl: coachVouchUrl(profile.id),
    displayName: profile.displayName,
  });
}
