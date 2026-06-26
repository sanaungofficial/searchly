import { getActingUser } from "@/lib/acting-user";
import { dbRowToMessage, messageToDbPayload, maybeRetitleThread } from "@/lib/kimchi-assistant/thread-serialize";
import type { StoredThreadMessage } from "@/lib/kimchi-assistant/thread-serialize";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const thread = await prisma.assistantThread.findFirst({ where: { id, userId: dbUser.id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    message?: StoredThreadMessage;
    messages?: StoredThreadMessage[];
  };

  const toSave = body.messages?.length ? body.messages : body.message ? [body.message] : [];
  if (toSave.length === 0) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const msg of toSave) {
      const payload = messageToDbPayload(msg);
      const row = await tx.assistantMessage.create({
        data: {
          threadId: id,
          kind: payload.kind,
          role: payload.role,
          content: payload.content,
          metadata: payload.metadata ?? undefined,
        },
      });
      rows.push(row);
    }
    await tx.assistantThread.update({ where: { id }, data: { updatedAt: new Date() } });
    return rows;
  });

  void maybeRetitleThread(prisma, id, dbUser.id);

  return NextResponse.json({
    messages: created.map(dbRowToMessage),
  });
}
