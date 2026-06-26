import { NextRequest, NextResponse } from "next/server";
import { JobActivityStatus, JobStage } from "@prisma/client";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { action?: "accept" | "dismiss" };

  const activity = await prisma.jobActivityLog.findFirst({
    where: { id, userId: dbUser.id },
  });
  if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "dismiss") {
    const updated = await prisma.jobActivityLog.update({
      where: { id },
      data: { status: JobActivityStatus.DISMISSED },
    });
    return NextResponse.json({ activity: updated });
  }

  if (body.action === "accept" && activity.suggestedStage && activity.jobId) {
    const job = await prisma.job.update({
      where: { id: activity.jobId },
      data: {
        stage: activity.suggestedStage as JobStage,
        ...(activity.suggestedStage === JobStage.APPLIED ? { appliedAt: new Date() } : {}),
      },
    });
    const updated = await prisma.jobActivityLog.update({
      where: { id },
      data: { status: JobActivityStatus.APPLIED, appliedStage: activity.suggestedStage },
    });
    return NextResponse.json({ activity: updated, job });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
