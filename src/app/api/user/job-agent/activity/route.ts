import { NextRequest, NextResponse } from "next/server";
import { JobActivityStatus } from "@prisma/client";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 50);
  const status = req.nextUrl.searchParams.get("status");

  const activities = await prisma.jobActivityLog.findMany({
    where: {
      userId: dbUser.id,
      ...(status ? { status: status as JobActivityStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      job: { select: { id: true, company: true, role: true, stage: true } },
    },
  });

  return NextResponse.json({
    activities: activities.map((a) => ({
      id: a.id,
      source: a.source,
      signal: a.signal,
      status: a.status,
      suggestedStage: a.suggestedStage,
      appliedStage: a.appliedStage,
      confidence: a.confidence,
      title: a.title,
      snippet: a.snippet,
      companyGuess: a.companyGuess,
      roleGuess: a.roleGuess,
      interviewAt: a.interviewAt?.toISOString() ?? null,
      nylasMessageId: a.nylasMessageId,
      nylasEventId: a.nylasEventId,
      createdAt: a.createdAt.toISOString(),
      job: a.job,
    })),
  });
}
