import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { sortMessagesByJobRelevance } from "@/lib/inbox-job-priority";
import { isNylasConfigured } from "@/lib/nylas";
import { listMessages, serializeMessageSummary } from "@/lib/nylas-inbox";
import { getUserEmailGrant } from "@/lib/user-email-server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getUserEmailGrant(dbUser.id);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const folderId = sp.get("folderId") ?? undefined;
  const pageToken = sp.get("pageToken") ?? undefined;
  const q = sp.get("q")?.trim();
  const limit = Math.min(Number(sp.get("limit") ?? 30), 50);

  try {
    const { messages, nextCursor } = await listMessages(grant.nylasGrantId, {
      folderId,
      pageToken,
      limit,
      searchQueryNative: q || undefined,
    });

    const ids = messages.map((m) => m.id);
    const activities = ids.length
      ? await prisma.jobActivityLog.findMany({
          where: { userId: dbUser.id, nylasMessageId: { in: ids } },
          include: { job: { select: { id: true, company: true, role: true, stage: true } } },
        })
      : [];

    const activityByMessageId = Object.fromEntries(
      activities.filter((a) => a.nylasMessageId).map((a) => [a.nylasMessageId!, a]),
    );

    const serialized = messages.map((m) => ({
      ...serializeMessageSummary(m),
      activity: activityByMessageId[m.id]
        ? {
            id: activityByMessageId[m.id].id,
            signal: activityByMessageId[m.id].signal,
            status: activityByMessageId[m.id].status,
            suggestedStage: activityByMessageId[m.id].suggestedStage,
            confidence: activityByMessageId[m.id].confidence,
            job: activityByMessageId[m.id].job,
          }
        : null,
    }));

    const ordered = q
      ? serialized
      : sortMessagesByJobRelevance(
          serialized.map((m) => ({
            ...m,
            hasAgentActivity: Boolean(m.activity),
          })),
        );

    return NextResponse.json({
      messages: ordered,
      nextCursor,
    });
  } catch (err) {
    console.error("[user/email/messages]", err);
    return NextResponse.json({ error: "Could not load messages" }, { status: 500 });
  }
}
