import { NextRequest, NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { isInboxUserTag } from "@/lib/email-sender-display";
import { serializeMessageActivity } from "@/lib/inbox-message-activity";
import { prisma } from "@/lib/prisma";

const activityInclude = {
  job: { select: { id: true, company: true, role: true, stage: true } },
  contact: { select: { id: true, email: true, name: true, company: true } },
} as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await resolveScopedDbUser(req);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: messageId } = await params;
  const body = (await req.json().catch(() => ({}))) as { tag?: InboxUserTag | "none" | null };

  if (body.tag !== null && body.tag !== "none" && body.tag !== undefined && !isInboxUserTag(body.tag)) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  }

  const existing = await prisma.inboxActivity.findFirst({
    where: { userId: dbUser.id, nylasMessageId: messageId },
    include: activityInclude,
  });

  if (body.tag === "none" || body.tag === null) {
    if (!existing) return NextResponse.json({ activity: null });
    const updated = await prisma.inboxActivity.update({
      where: { id: existing.id },
      data: { userTag: null },
      include: activityInclude,
    });
    return NextResponse.json({ activity: serializeMessageActivity(updated) });
  }

  if (existing) {
    const updated = await prisma.inboxActivity.update({
      where: { id: existing.id },
      data: { userTag: body.tag },
      include: activityInclude,
    });
    return NextResponse.json({ activity: serializeMessageActivity(updated) });
  }

  const created = await prisma.inboxActivity.create({
    data: {
      userId: dbUser.id,
      kind: "EMAIL",
      direction: "INBOUND",
      category: "UNKNOWN",
      nylasMessageId: messageId,
      userTag: body.tag,
    },
    include: activityInclude,
  });

  return NextResponse.json({ activity: serializeMessageActivity(created) });
}
