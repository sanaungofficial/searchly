import { getActingUser } from "@/lib/acting-user";
import { dbRowToMessage } from "@/lib/kimchi-assistant/thread-serialize";
import { NEW_THREAD_TITLE, WELCOME_MESSAGE } from "@/lib/kimchi-assistant/chat-chips";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threads = await prisma.assistantThread.findMany({
    where: { userId: dbUser.id },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      updatedAt: t.updatedAt.toISOString(),
      messageCount: t._count.messages,
    })),
  });
}

export async function POST() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thread = await prisma.assistantThread.create({
    data: {
      userId: dbUser.id,
      title: NEW_THREAD_TITLE,
      messages: {
        create: {
          kind: "text",
          role: "assistant",
          content: WELCOME_MESSAGE,
        },
      },
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({
    thread: {
      id: thread.id,
      title: thread.title,
      updatedAt: thread.updatedAt.toISOString(),
      messages: thread.messages.map(dbRowToMessage),
    },
  });
}
