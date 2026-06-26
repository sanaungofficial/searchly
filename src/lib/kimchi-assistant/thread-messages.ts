import { dbRowToMessage } from "@/lib/kimchi-assistant/thread-serialize";
import type { StoredThreadMessage } from "@/lib/kimchi-assistant/thread-serialize";
import { WELCOME_MESSAGE, NEW_THREAD_TITLE } from "@/lib/kimchi-assistant/chat-chips";

export function normalizeThreadMessages(raw: unknown): StoredThreadMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ kind: "text", role: "assistant", content: WELCOME_MESSAGE }];
  }
  return raw.map((item) => {
    const row = item as {
      id?: string;
      kind?: string;
      role?: string;
      content?: string;
      metadata?: unknown;
    };
    if (row.kind === "voice" && row.content) {
      return dbRowToMessage({
        id: row.id ?? "",
        kind: "voice",
        role: row.role ?? "assistant",
        content: row.content,
        metadata: row.metadata,
      });
    }
    return {
      kind: "text" as const,
      id: row.id,
      role: (row.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: row.content ?? "",
    };
  });
}

export function isNewThreadTitle(title: string | null | undefined): boolean {
  return title === "New chat" || title === NEW_THREAD_TITLE;
}
