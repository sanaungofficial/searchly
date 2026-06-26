import { NextRequest, NextResponse } from "next/server";
import { JobActivitySource, JobActivitySignal, JobActivityStatus } from "@prisma/client";
import { getActingUser } from "@/lib/acting-user";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { serializeMessageActivity } from "@/lib/inbox-message-activity";
import { prisma } from "@/lib/prisma";

const VALID_TAGS = new Set<InboxUserTag>(["needs_follow_up", "answered", "potential", "waiting"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: messageId } = await params;
  const body = (await req.json().catch(() => ({}))) as { tag?: InboxUserTag | "none" | null };

  if (body.tag !== null && body.tag !== "none" && body.tag !== undefined && !VALID_TAGS.has(body.tag)) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  }

  const existing = await prisma.jobActivityLog.findFirst({
    where: { userId: dbUser.id, nylasMessageId: messageId },
    include: { job: { select: { id: true, company: true, role: true, stage: true } } },
  });

  if (body.tag === "none" || body.tag === null) {
    if (!existing) return NextResponse.json({ activity: null });
    const raw = (existing.rawPayload && typeof existing.rawPayload === "object"
      ? { ...(existing.rawPayload as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    delete raw.userTag;
    const updated = await prisma.jobActivityLog.update({
      where: { id: existing.id },
      data: { rawPayload: Object.keys(raw).length ? raw : undefined },
      include: { job: { select: { id: true, company: true, role: true, stage: true } } },
    });
    return NextResponse.json({ activity: serializeMessageActivity(updated) });
  }

  if (existing) {
    const raw = (existing.rawPayload && typeof existing.rawPayload === "object"
      ? { ...(existing.rawPayload as Record<string, unknown>) }
      : {}) as Record<string, unknown>;
    raw.userTag = body.tag;
    const updated = await prisma.jobActivityLog.update({
      where: { id: existing.id },
      data: { rawPayload: raw },
      include: { job: { select: { id: true, company: true, role: true, stage: true } } },
    });
    return NextResponse.json({ activity: serializeMessageActivity(updated) });
  }

  const created = await prisma.jobActivityLog.create({
    data: {
      userId: dbUser.id,
      source: JobActivitySource.EMAIL,
      signal: JobActivitySignal.OTHER,
      status: JobActivityStatus.APPLIED,
      nylasMessageId: messageId,
      rawPayload: { userTag: body.tag },
    },
    include: { job: { select: { id: true, company: true, role: true, stage: true } } },
  });

  return NextResponse.json({ activity: serializeMessageActivity(created) });
}
