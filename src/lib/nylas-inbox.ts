import { nylasFetch } from "@/lib/nylas";

export type NylasMessage = {
  id: string;
  subject?: string;
  snippet?: string;
  body?: string;
  from?: Array<{ email?: string; name?: string }>;
  to?: Array<{ email?: string; name?: string }>;
  date?: number;
  thread_id?: string;
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

type ListResponse<T> = { data?: T[] };

export async function fetchRecentMessages(grantId: string, receivedAfter?: Date, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (receivedAfter) {
    params.set("received_after", String(Math.floor(receivedAfter.getTime() / 1000)));
  }

  const res = await nylasFetch<ListResponse<NylasMessage>>(
    `/v3/grants/${grantId}/messages?${params.toString()}`,
    { grantId },
  );
  return res.data ?? [];
}

export async function fetchMessage(grantId: string, messageId: string) {
  const res = await nylasFetch<{ data?: NylasMessage }>(
    `/v3/grants/${grantId}/messages/${messageId}`,
    { grantId },
  );
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
