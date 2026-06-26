import { nylasFetch } from "@/lib/nylas";

export type NylasParticipant = { email?: string; name?: string };

export type NylasMessage = {
  id: string;
  subject?: string;
  snippet?: string;
  body?: string;
  from?: NylasParticipant[];
  to?: NylasParticipant[];
  cc?: NylasParticipant[];
  bcc?: NylasParticipant[];
  date?: number;
  thread_id?: string;
  unread?: boolean;
  starred?: boolean;
  folders?: string[];
};

export type NylasFolder = {
  id: string;
  name?: string;
  system_folder?: string;
  unread_count?: number;
  total_count?: number;
};

export type NylasEvent = {
  id: string;
  title?: string;
  description?: string;
  when?: {
    start_time?: number;
    end_time?: number;
    start_timezone?: string;
    end_timezone?: string;
  };
  participants?: Array<{ email?: string; name?: string; status?: string }>;
  location?: string;
};

type ListResponse<T> = { data?: T[]; next_cursor?: string };

export type ListMessagesOptions = {
  limit?: number;
  pageToken?: string;
  receivedAfter?: Date;
  folderId?: string;
  searchQueryNative?: string;
  threadId?: string;
};

export async function fetchFolders(grantId: string): Promise<NylasFolder[]> {
  const res = await nylasFetch<ListResponse<NylasFolder>>(`/v3/grants/${grantId}/folders?limit=50`, {
    grantId,
  });
  return res.data ?? [];
}

export async function listMessages(grantId: string, options: ListMessagesOptions = {}) {
  const params = new URLSearchParams({ limit: String(options.limit ?? 30) });
  if (options.pageToken) params.set("page_token", options.pageToken);
  if (options.receivedAfter) {
    params.set("received_after", String(Math.floor(options.receivedAfter.getTime() / 1000)));
  }
  if (options.folderId) params.set("in", options.folderId);
  if (options.searchQueryNative) params.set("search_query_native", options.searchQueryNative);
  if (options.threadId) params.set("thread_id", options.threadId);

  const res = await nylasFetch<ListResponse<NylasMessage> & { next_cursor?: string }>(
    `/v3/grants/${grantId}/messages?${params.toString()}`,
    { grantId },
  );
  return { messages: res.data ?? [], nextCursor: res.next_cursor ?? null };
}

export async function fetchRecentMessages(grantId: string, receivedAfter?: Date, limit = 20) {
  const { messages } = await listMessages(grantId, { receivedAfter, limit });
  return messages;
}

export async function fetchMessage(grantId: string, messageId: string) {
  const res = await nylasFetch<{ data?: NylasMessage }>(
    `/v3/grants/${grantId}/messages/${messageId}`,
    { grantId },
  );
  return res.data ?? null;
}

export type SendMessageInput = {
  subject: string;
  body: string;
  to: NylasParticipant[];
  cc?: NylasParticipant[];
  bcc?: NylasParticipant[];
  replyToMessageId?: string;
};

export async function sendMessage(grantId: string, input: SendMessageInput) {
  const body: Record<string, unknown> = {
    subject: input.subject,
    body: input.body,
    to: input.to.filter((p) => p.email?.trim()),
  };
  if (input.cc?.length) body.cc = input.cc.filter((p) => p.email?.trim());
  if (input.bcc?.length) body.bcc = input.bcc.filter((p) => p.email?.trim());
  if (input.replyToMessageId) body.reply_to_message_id = input.replyToMessageId;

  const res = await nylasFetch<{ data?: NylasMessage }>(`/v3/grants/${grantId}/messages/send`, {
    method: "POST",
    grantId,
    body,
  });
  return res.data ?? null;
}

export async function fetchUpcomingEvents(grantId: string, daysAhead = 14) {
  const start = Math.floor(Date.now() / 1000);
  const end = start + daysAhead * 24 * 60 * 60;
  const params = new URLSearchParams({
    start: String(start),
    end: String(end),
    limit: "50",
  });

  const res = await nylasFetch<ListResponse<NylasEvent>>(
    `/v3/grants/${grantId}/events?${params.toString()}`,
    { grantId },
  );
  return res.data ?? [];
}

export async function fetchEvent(grantId: string, eventId: string) {
  const res = await nylasFetch<{ data?: NylasEvent }>(
    `/v3/grants/${grantId}/events/${eventId}`,
    { grantId },
  );
  return res.data ?? null;
}

export async function revokeGrant(grantId: string) {
  await nylasFetch(`/v3/grants/${grantId}`, { method: "DELETE", grantId });
}

export function messagePlainText(msg: NylasMessage): string {
  const body = msg.body ?? msg.snippet ?? "";
  if (body.includes("<")) {
    return body
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return body.trim();
}

export function messageFromLine(msg: NylasMessage): string {
  const from = msg.from?.[0];
  if (!from) return "Unknown sender";
  return from.name ? `${from.name} <${from.email}>` : (from.email ?? "Unknown");
}

export function participantsLine(list?: NylasParticipant[]): string {
  if (!list?.length) return "";
  return list
    .map((p) => (p.name ? `${p.name} <${p.email}>` : p.email))
    .filter(Boolean)
    .join(", ");
}

export function formatMessageDate(unix?: number): string {
  if (!unix) return "";
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function serializeMessageSummary(msg: NylasMessage) {
  return {
    id: msg.id,
    subject: msg.subject ?? "(No subject)",
    snippet: msg.snippet ?? "",
    from: messageFromLine(msg),
    fromEmail: msg.from?.[0]?.email ?? null,
    date: msg.date ?? null,
    dateLabel: formatMessageDate(msg.date),
    unread: Boolean(msg.unread),
    starred: Boolean(msg.starred),
    threadId: msg.thread_id ?? null,
  };
}
