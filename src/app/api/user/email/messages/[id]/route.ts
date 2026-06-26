import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { parseInboxLens, resolveInboxGrant } from "@/lib/inbox-lens";
import { isNylasConfigured } from "@/lib/nylas";
import {
  fetchFolders,
  fetchMessage,
  listThreadMessages,
  messageFromLine,
  messagePlainText,
  participantsLine,
  serializeAttachments,
  serializeMessageSummary,
  updateMessage,
} from "@/lib/nylas-inbox";
import { prisma } from "@/lib/prisma";

async function loadGrant(dbUser: { id: string; role: string; email: string }, req: NextRequest) {
  const lens = parseInboxLens(req.nextUrl.searchParams.get("lens"));
  const resolved = await resolveInboxGrant(dbUser.id, dbUser.role, dbUser.email, lens);
  return { lens, grant: resolved };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const { lens, grant } = await loadGrant(dbUser, req);
  if (!grant) {
    return NextResponse.json(
      { error: lens === "work" ? "Work inbox not connected" : "Inbox not connected" },
      { status: 404 },
    );
  }

  const { id } = await params;
  const includeThread = req.nextUrl.searchParams.get("thread") === "1";

  try {
    const message = await fetchMessage(grant.nylasGrantId, id);
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const activity =
      lens === "job_search"
        ? await prisma.jobActivityLog.findFirst({
            where: { userId: dbUser.id, nylasMessageId: id },
            include: { job: { select: { id: true, company: true, role: true, stage: true } } },
          })
        : null;

    const bodyHtml = message.body?.includes("<") ? message.body : null;
    const bodyText = messagePlainText(message);

    let thread: ReturnType<typeof serializeMessageSummary>[] = [];
    if (includeThread && message.thread_id) {
      const { messages: threadMessages } = await listThreadMessages(grant.nylasGrantId, message.thread_id, 25);
      thread = threadMessages.map(serializeMessageSummary);
    }

    return NextResponse.json({
      ...serializeMessageSummary(message),
      to: participantsLine(message.to),
      cc: participantsLine(message.cc),
      from: messageFromLine(message),
      bodyHtml,
      bodyText,
      attachments: serializeAttachments(message),
      thread,
      activity: activity
        ? {
            id: activity.id,
            source: activity.source,
            signal: activity.signal,
            status: activity.status,
            suggestedStage: activity.suggestedStage,
            appliedStage: activity.appliedStage,
            confidence: activity.confidence,
            title: activity.title,
            snippet: activity.snippet,
            companyGuess: activity.companyGuess,
            roleGuess: activity.roleGuess,
            interviewAt: activity.interviewAt?.toISOString() ?? null,
            job: activity.job,
          }
        : null,
    });
  } catch (err) {
    console.error("[user/email/messages/id]", err);
    return NextResponse.json({ error: "Could not load message" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const { grant } = await loadGrant(dbUser, req);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    unread?: boolean;
    starred?: boolean;
    archive?: boolean;
  };

  try {
    let folders: string[] | undefined;
    if (body.archive) {
      const message = await fetchMessage(grant.nylasGrantId, id);
      const allFolders = await fetchFolders(grant.nylasGrantId);
      const archiveFolder =
        allFolders.find((f) => f.attributes?.includes("\\Archive")) ??
        allFolders.find((f) => f.name?.toLowerCase().includes("archive"));
      if (archiveFolder && message) {
        folders = [archiveFolder.id];
      }
    }

    const updated = await updateMessage(grant.nylasGrantId, id, {
      ...(body.unread !== undefined ? { unread: body.unread } : {}),
      ...(body.starred !== undefined ? { starred: body.starred } : {}),
      ...(folders ? { folders } : {}),
    });

    if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    return NextResponse.json({ message: serializeMessageSummary(updated) });
  } catch (err) {
    console.error("[user/email/messages/id PATCH]", err);
    return NextResponse.json({ error: "Could not update message" }, { status: 500 });
  }
}
