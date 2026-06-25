import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachStatus } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const coach = await prisma.coachProfile.findFirst({
    where: {
      status: CoachStatus.ACTIVE,
      OR: [{ slug }, { id: slug }],
    },
    select: {
      nylasSchedulerConfigId: true,
      nylasSchedulerSlug: true,
      calLink: true,
    },
  });

  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  return NextResponse.json({
    hasNylas: Boolean(coach.nylasSchedulerConfigId),
    configurationId: coach.nylasSchedulerConfigId,
    schedulerSlug: coach.nylasSchedulerSlug,
    calLink: coach.calLink,
  });
}
