import { NextRequest, NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { resolveInboxGrant } from "@/lib/inbox-lens";
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
import { serializeMessageActivity } from "@/lib/inbox-message-activity";
import { prisma } from "@/lib/prisma";

async function loadGrant(userId: string) {
  return resolveInboxGrant(userId);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await resolveScopedDbUser(req);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await loadGrant(dbUser.id);
  if (!grant) {
    return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });
  }

  const { id } = await params;
  const includeThread = req.nextUrl.searchParams.get("thread") === "1";

  try {
    const message = await fetchMessage(grant.nylasGrantId, id);
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const bodyHtml = message.body?.includes("<") ? message.body : null;
    const bodyText = messagePlainText(message);

    let thread: ReturnType<typeof serializeMessageSummary>[] = [];
    if (includeThread && message.thread_id) {
      const { messages: threadMessages } = await listThreadMessages(grant.nylasGrantId, message.thread_id, 25);
      thread = threadMessages.map(serializeMessageSummary);
    }

    const activityRow = await prisma.inboxActivity.findFirst({
      where: { userId: dbUser.id, nylasMessageId: id },
      include: {
        job: { select: { id: true, company: true, role: true, stage: true } },
        contact: { select: { id: true, email: true, name: true, company: true } },
      },
    });

    return NextResponse.json({
      ...serializeMessageSummary(message),
      to: participantsLine(message.to),
      cc: participantsLine(message.cc),
      from: messageFromLine(message),
      bodyHtml,
      bodyText,
      attachments: serializeAttachments(message),
      thread,
      activity: serializeMessageActivity(activityRow),
    });
  } catch (err) {
    console.error("[user/email/messages/id]", err);
    return NextResponse.json({ error: "Could not load message" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await resolveScopedDbUser(req);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await loadGrant(dbUser.id);
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
