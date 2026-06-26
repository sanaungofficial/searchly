import { NextRequest, NextResponse } from "next/server";
import { JobActivityStatus, JobStage } from "@prisma/client";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";
import { fetchMessage, markMessageProcessed } from "@/lib/nylas-inbox";
import { getUserEmailGrant } from "@/lib/user-email-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "accept" | "dismiss" | "link";
    jobId?: string;
    createJob?: boolean;
    applyStage?: boolean;
    labelProcessed?: boolean;
  };

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

  if (body.action === "link") {
    const jobId = body.jobId ?? activity.jobId;
    if (!jobId) {
      return NextResponse.json({ error: "Select a pipeline job to link" }, { status: 400 });
    }

    const job = await prisma.job.findFirst({ where: { id: jobId, userId: dbUser.id } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const updated = await prisma.jobActivityLog.update({
      where: { id },
      data: {
        jobId,
        status: JobActivityStatus.APPLIED,
        appliedStage: null,
      },
    });

    return NextResponse.json({ activity: updated, job });
  }

  if (body.action === "accept") {
    let jobId = activity.jobId ?? body.jobId ?? null;
    const applyStage = body.applyStage === true && Boolean(activity.suggestedStage);

    if (!jobId && body.createJob !== false && activity.companyGuess) {
      const created = await prisma.job.create({
        data: {
          userId: dbUser.id,
          company: activity.companyGuess,
          role: activity.roleGuess ?? "Role from email",
          stage: applyStage && activity.suggestedStage ? activity.suggestedStage : JobStage.SAVED,
          ...(applyStage && activity.suggestedStage === JobStage.APPLIED ? { appliedAt: new Date() } : {}),
        },
      });
      jobId = created.id;
    }

    if (!jobId) {
      return NextResponse.json({ error: "Link a pipeline job or add this role" }, { status: 400 });
    }

    if (activity.jobId !== jobId) {
      await prisma.jobActivityLog.update({
        where: { id },
        data: { jobId },
      });
    }

    let job = await prisma.job.findFirst({ where: { id: jobId, userId: dbUser.id } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (applyStage && activity.suggestedStage) {
      job = await prisma.job.update({
        where: { id: jobId },
        data: {
          stage: activity.suggestedStage as JobStage,
          ...(activity.suggestedStage === JobStage.APPLIED ? { appliedAt: new Date() } : {}),
        },
      });
    }

    const updated = await prisma.jobActivityLog.update({
      where: { id },
      data: {
        status: JobActivityStatus.APPLIED,
        appliedStage: applyStage ? activity.suggestedStage : null,
        jobId,
      },
    });

    if (body.labelProcessed !== false && activity.nylasMessageId) {
      const grant = await getUserEmailGrant(dbUser.id);
      if (grant) {
        const message = await fetchMessage(grant.nylasGrantId, activity.nylasMessageId);
        if (message) {
          markMessageProcessed(grant.nylasGrantId, message).catch((err) =>
            console.error("[job-agent/activity] label processed", err),
          );
        }
      }
    }

    return NextResponse.json({ activity: updated, job });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
