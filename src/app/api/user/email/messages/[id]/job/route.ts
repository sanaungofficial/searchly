import { NextRequest, NextResponse } from "next/server";
import { JobStage } from "@prisma/client";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { serializeMessageActivity } from "@/lib/inbox-message-activity";
import { linkActivityToJob } from "@/lib/inbox-crm/link-job";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await resolveScopedDbUser(req);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: messageId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    jobId?: string | null;
    role?: string | null;
    create?: { company?: string; role?: string; stage?: string };
  };

  const activity = await prisma.inboxActivity.findFirst({
    where: { userId: dbUser.id, nylasMessageId: messageId },
    select: { id: true },
  });

  if (!activity) {
    return NextResponse.json({ error: "No activity for this message yet — refresh or sync inbox." }, { status: 404 });
  }

  try {
    let jobId = body.jobId ?? null;

    if (body.create?.company?.trim() && body.create?.role?.trim()) {
      const stage =
        body.create.stage && Object.values(JobStage).includes(body.create.stage as JobStage)
          ? (body.create.stage as JobStage)
          : JobStage.SAVED;
      const job = await prisma.job.create({
        data: {
          userId: dbUser.id,
          company: body.create.company.trim(),
          role: body.create.role.trim(),
          stage,
        },
      });
      jobId = job.id;
    }

    const updated = await linkActivityToJob({
      userId: dbUser.id,
      activityId: activity.id,
      jobId,
      contactRole: body.role,
    });
    return NextResponse.json({ activity: serializeMessageActivity(updated), jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not link job";
    if (message === "JOB_NOT_FOUND") {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not link job" }, { status: 500 });
  }
}
