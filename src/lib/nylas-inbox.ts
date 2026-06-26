import { nylasFetch } from "@/lib/nylas";
import { buildSenderAvatarUrls } from "@/lib/email-sender-display";

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
  attachments?: NylasAttachment[];
};

export type NylasAttachment = {
  id: string;
  filename?: string;
  content_type?: string;
  size?: number;
};

export type NylasFolder = {
  id: string;
  name?: string;
  /** Google: true when provider-created label/folder. */
  system_folder?: boolean;
  /** RFC-style folder role, e.g. `\\Inbox`, `\\Sent`. */
  attributes?: string[];
  unread_count?: number;
  total_count?: number;
};

const FOLDER_ATTR_RANK: Record<string, number> = {
  "\\Inbox": 0,
  "\\Sent": 1,
  "\\Drafts": 2,
  "\\Archive": 3,
  "\\Junk": 4,
  "\\Trash": 5,
};

function folderAttributes(folder: NylasFolder): string[] {
  return folder.attributes ?? [];
}

function folderPrimaryAttribute(folder: NylasFolder): string | null {
  for (const attr of folderAttributes(folder)) {
    if (attr in FOLDER_ATTR_RANK) return attr;
  }
  return null;
}

export function folderDisplayName(folder: NylasFolder): string {
  const attr = folderPrimaryAttribute(folder);
  if (attr === "\\Inbox") return "Inbox";
  if (attr === "\\Sent") return "Sent";
  if (attr === "\\Drafts") return "Drafts";
  if (attr === "\\Archive") return "Archive";
  if (attr === "\\Junk") return "Spam";
  if (attr === "\\Trash") return "Trash";

  const name = folder.name?.trim();
  if (!name) return "Folder";
  if (name === name.toUpperCase() && name.length > 1) {
    return name.charAt(0) + name.slice(1).toLowerCase();
  }
  return name;
}

export function isInboxFolder(folder: NylasFolder): boolean {
  if (folderAttributes(folder).includes("\\Inbox")) return true;
  const name = folder.name?.trim().toLowerCase();
  return folder.id === "INBOX" || name === "inbox";
}

export function folderSortRank(folder: NylasFolder): number {
  const attr = folderPrimaryAttribute(folder);
  if (attr) return FOLDER_ATTR_RANK[attr] ?? 10;
  const name = folder.name?.toLowerCase() ?? "";
  if (name.includes("inbox")) return 0;
  if (name.includes("sent")) return 1;
  if (name.includes("draft")) return 2;
  if (name.includes("star")) return 3;
  return 20;
}

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
  const res = await nylasFetch<ListResponse<NylasFolder>>(`/v3/grants/${grantId}/folders?limit=200`, {
    grantId,
  });
  const folders = res.data ?? [];
  return [...folders].sort(
    (a, b) => folderSortRank(a) - folderSortRank(b) || folderDisplayName(a).localeCompare(folderDisplayName(b)),
  );
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
    `/v3/grants/${grantId}/messages/${messageId}?query_imap=true`,
    { grantId },
  );
  return res.data ?? null;
}

export type UpdateMessageInput = {
  unread?: boolean;
  starred?: boolean;
  folders?: string[];
};

export async function updateMessage(grantId: string, messageId: string, input: UpdateMessageInput) {
  const body: Record<string, unknown> = {};
  if (input.unread !== undefined) body.unread = input.unread;
  if (input.starred !== undefined) body.starred = input.starred;
  if (input.folders !== undefined) body.folders = input.folders;

  const res = await nylasFetch<{ data?: NylasMessage }>(
    `/v3/grants/${grantId}/messages/${messageId}`,
    { method: "PUT", grantId, body },
  );
  return res.data ?? null;
}

export async function listThreadMessages(grantId: string, threadId: string, limit = 20) {
  return listMessages(grantId, { threadId, limit });
}

export async function downloadAttachment(grantId: string, attachmentId: string, messageId: string) {
  const res = await nylasFetch<{ data?: { content?: string; content_type?: string; filename?: string } }>(
    `/v3/grants/${grantId}/attachments/${attachmentId}/download?message_id=${encodeURIComponent(messageId)}`,
    { grantId },
  );
  return res.data ?? null;
}

/** Find or create a Gmail label for agent-processed mail. */
export async function ensureKimchiProcessedFolder(grantId: string): Promise<string | null> {
  const folders = await fetchFolders(grantId);
  const existing = folders.find((f) => f.name?.toLowerCase() === "kimchi/processed");
  if (existing) return existing.id;

  try {
    const res = await nylasFetch<{ data?: NylasFolder }>(`/v3/grants/${grantId}/folders`, {
      method: "POST",
      grantId,
      body: { name: "Kimchi/Processed" },
    });
    return res.data?.id ?? null;
  } catch {
    return null;
  }
}

export async function markMessageProcessed(grantId: string, message: NylasMessage) {
  const labelId = await ensureKimchiProcessedFolder(grantId);
  if (!labelId || !message.id) return null;
  const folders = [...(message.folders ?? []), labelId];
  return updateMessage(grantId, message.id, { folders: [...new Set(folders)] });
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
  const fromLine = messageFromLine(msg);
  const fromEmail = msg.from?.[0]?.email ?? null;
  const sender = buildSenderAvatarUrls(fromLine, fromEmail);
  return {
    id: msg.id,
    subject: msg.subject ?? "(No subject)",
    snippet: msg.snippet ?? "",
    from: fromLine,
    fromEmail: sender.email,
    fromName: sender.displayName,
    avatar: {
      primary: sender.primary,
      fallback: sender.fallback,
      initials: sender.initials,
    },
    date: msg.date ?? null,
    dateLabel: formatMessageDate(msg.date),
    unread: Boolean(msg.unread),
    starred: Boolean(msg.starred),
    threadId: msg.thread_id ?? null,
    attachmentCount: msg.attachments?.length ?? 0,
  };
}

export function serializeAttachments(msg: NylasMessage) {
  return (msg.attachments ?? []).map((a) => ({
    id: a.id,
    filename: a.filename ?? "attachment",
    contentType: a.content_type ?? "application/octet-stream",
    size: a.size ?? 0,
  }));
}
