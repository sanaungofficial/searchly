import { NextRequest, NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { serializeMessageActivity } from "@/lib/inbox-message-activity";
import { linkActivityToJob } from "@/lib/inbox-crm/link-job";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await resolveScopedDbUser(req);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: messageId } = await params;
  const body = (await req.json().catch(() => ({}))) as { jobId?: string | null; role?: string | null };

  const activity = await prisma.inboxActivity.findFirst({
    where: { userId: dbUser.id, nylasMessageId: messageId },
    select: { id: true },
  });

  if (!activity) {
    return NextResponse.json({ error: "No activity for this message yet — refresh or sync inbox." }, { status: 404 });
  }

  try {
    const updated = await linkActivityToJob({
      userId: dbUser.id,
      activityId: activity.id,
      jobId: body.jobId ?? null,
      contactRole: body.role,
    });
    return NextResponse.json({ activity: serializeMessageActivity(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not link job";
    if (message === "JOB_NOT_FOUND") {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not link job" }, { status: 500 });
  }
}
