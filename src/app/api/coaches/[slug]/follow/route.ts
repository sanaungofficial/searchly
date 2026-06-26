import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";
import { getClientCoachingUser } from "@/lib/coach-api";

async function resolveCoach(slug: string) {
  return prisma.coachProfile.findFirst({
    where: {
      status: CoachStatus.ACTIVE,
      OR: [{ slug }, { id: slug }],
    },
    select: { id: true },
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const me = await getClientCoachingUser(_req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const coach = await resolveCoach(slug);
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  await prisma.coachFollow.upsert({
    where: { userId_coachProfileId: { userId: me.id, coachProfileId: coach.id } },
    create: { userId: me.id, coachProfileId: coach.id },
    update: {},
  });

  const followerCount = await prisma.coachFollow.count({ where: { coachProfileId: coach.id } });
  return NextResponse.json({ ok: true, isFollowing: true, followerCount });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const me = await getClientCoachingUser(_req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const coach = await resolveCoach(slug);
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  await prisma.coachFollow.deleteMany({
    where: { userId: me.id, coachProfileId: coach.id },
  });

  const followerCount = await prisma.coachFollow.count({ where: { coachProfileId: coach.id } });
  return NextResponse.json({ ok: true, isFollowing: false, followerCount });
}
