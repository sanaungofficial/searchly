import type { DebriefAction } from "@/lib/kimchi-assistant/debrief";
import type { VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";

export type StoredTextMessage = {
  kind: "text";
  id?: string;
  role: "user" | "assistant";
  content: string;
};

export type StoredVoiceMessage = {
  kind: "voice";
  id?: string;
  presetId: VoicePresetId;
  presetTitle: string;
  summary: string;
  bullets: string[];
  actions: DebriefAction[];
  rawTranscript: string;
};

export type StoredThreadMessage = StoredTextMessage | StoredVoiceMessage;

export function dbRowToMessage(row: {
  id: string;
  kind: string;
  role: string;
  content: string;
  metadata: unknown;
}): StoredThreadMessage {
  if (row.kind === "voice") {
    const meta = (row.metadata ?? {}) as Partial<StoredVoiceMessage>;
    return {
      kind: "voice",
      id: row.id,
      presetId: (meta.presetId as VoicePresetId) ?? "general",
      presetTitle: meta.presetTitle ?? "Voice chat",
      summary: row.content,
      bullets: meta.bullets ?? [],
      actions: meta.actions ?? [],
      rawTranscript: meta.rawTranscript ?? "",
    };
  }
  return {
    kind: "text",
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
  };
}

export function messageToDbPayload(msg: StoredThreadMessage): {
  kind: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
} {
  if (msg.kind === "voice") {
    return {
      kind: "voice",
      role: "assistant",
      content: msg.summary,
      metadata: {
        presetId: msg.presetId,
        presetTitle: msg.presetTitle,
        bullets: msg.bullets,
        actions: msg.actions,
        rawTranscript: msg.rawTranscript,
      },
    };
  }
  return {
    kind: "text",
    role: msg.role,
    content: msg.content,
    metadata: null,
  };
}

export function titleFromMessages(messages: StoredThreadMessage[]): string {
  const firstUser = messages.find((m) => m.kind === "text" && m.role === "user");
  if (firstUser && firstUser.kind === "text") {
    return firstUser.content.slice(0, 48) + (firstUser.content.length > 48 ? "…" : "");
  }
  const voice = messages.find((m) => m.kind === "voice");
  if (voice && voice.kind === "voice") return voice.presetTitle;
  return "New thread";
}

export async function maybeRetitleThread(
  prisma: import("@prisma/client").PrismaClient,
  threadId: string,
  userId: string,
) {
  const thread = await prisma.assistantThread.findFirst({
    where: { id: threadId, userId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 6 } },
  });
  if (!thread || (thread.title !== "New chat" && thread.title !== "New thread")) return;

  const msgs = thread.messages.map(dbRowToMessage);
  const title = titleFromMessages(msgs);
  if (title !== "New chat" && title !== "New thread") {
    await prisma.assistantThread.update({ where: { id: threadId }, data: { title } });
  }
}
