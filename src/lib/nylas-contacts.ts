import { nylasFetch } from "@/lib/nylas";

export type NylasContactRecord = {
  id: string;
  given_name?: string;
  surname?: string;
  company_name?: string;
  job_title?: string;
  emails?: Array<{ email?: string; type?: string }>;
  phone_numbers?: Array<{ number?: string; type?: string }>;
};

type ListResponse = { data?: NylasContactRecord[]; next_cursor?: string };

export function nylasContactDisplayName(contact: NylasContactRecord): string | null {
  const parts = [contact.given_name, contact.surname].filter(Boolean);
  if (parts.length) return parts.join(" ");
  const email = contact.emails?.[0]?.email?.trim();
  return email ?? null;
}

export function nylasContactPrimaryEmail(contact: NylasContactRecord): string | null {
  return contact.emails?.find((e) => e.email?.trim())?.email?.trim().toLowerCase() ?? null;
}

export async function listNylasContacts(
  grantId: string,
  options?: { limit?: number; pageToken?: string; email?: string },
): Promise<{ contacts: NylasContactRecord[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: String(options?.limit ?? 100) });
  if (options?.pageToken) params.set("page_token", options.pageToken);
  if (options?.email) params.set("email", options.email);

  const res = await nylasFetch<ListResponse>(`/v3/grants/${grantId}/contacts?${params.toString()}`, {
    grantId,
  });

  return { contacts: res.data ?? [], nextCursor: res.next_cursor ?? null };
}

export async function fetchAllNylasContacts(grantId: string, maxPages = 10) {
  const all: NylasContactRecord[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i += 1) {
    const { contacts, nextCursor } = await listNylasContacts(grantId, { pageToken, limit: 200 });
    all.push(...contacts);
    if (!nextCursor) break;
    pageToken = nextCursor;
  }
  return all;
}

export async function createNylasContact(
  grantId: string,
  input: {
    email: string;
    name?: string | null;
    company?: string | null;
    title?: string | null;
  },
): Promise<NylasContactRecord | null> {
  const trimmed = input.email.trim().toLowerCase();
  if (!trimmed) return null;

  const nameParts = (input.name ?? "").trim().split(/\s+/).filter(Boolean);
  const body: Record<string, unknown> = {
    emails: [{ email: trimmed, type: "work" }],
  };
  if (nameParts[0]) body.given_name = nameParts[0];
  if (nameParts.length > 1) body.surname = nameParts.slice(1).join(" ");
  if (input.company?.trim()) body.company_name = input.company.trim();
  if (input.title?.trim()) body.job_title = input.title.trim();

  const res = await nylasFetch<{ data?: NylasContactRecord }>(`/v3/grants/${grantId}/contacts`, {
    method: "POST",
    grantId,
    body,
  });
  return res.data ?? null;
}

export async function lookupNylasContactByEmail(grantId: string, email: string) {
  const { contacts } = await listNylasContacts(grantId, { email: email.trim().toLowerCase(), limit: 5 });
  return contacts[0] ?? null;
}
