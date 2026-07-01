/**
 * Partnero REST API client — refer-a-friend program.
 * Docs: https://docs.partnero.com/guides/tracking/refer-a-friend-api
 */

import { resolveAppUrl } from "@/lib/site-host";

const PARTNERO_API = "https://api.partnero.com/v1";

export type PartneroCustomer = {
  id?: string;
  key?: string;
  email?: string;
  name?: string;
  surname?: string | null;
  referral_link?: string;
  referral_links?: string[];
  referrals_count?: number;
  referring_customer?: { key?: string; id?: string; email?: string } | null;
  created_at?: string;
};

export type PartneroCustomerStats = {
  clicks?: number;
  referrals?: number;
  referrals_count?: number;
  [key: string]: unknown;
};

function apiKey(): string {
  const key = process.env.PARTNERO_API_KEY;
  if (!key) throw new Error("PARTNERO_API_KEY is not configured");
  return key;
}

export function partneroEnabled(): boolean {
  return Boolean(process.env.PARTNERO_API_KEY);
}

/** Stable Partnero customer key — Kimchi user id. */
export function partneroCustomerKey(userId: string): string {
  return userId;
}

async function partneroFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: T | null; raw: unknown }> {
  const res = await fetch(`${PARTNERO_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let raw: unknown = null;
  try {
    raw = await res.json();
  } catch {
    raw = null;
  }

  const envelope = raw as { status?: number; data?: T } | null;
  return {
    status: res.status,
    data: envelope?.data ?? null,
    raw,
  };
}

export async function createPartneroCustomer(input: {
  key: string;
  email: string;
  name?: string | null;
  referringCustomerKey?: string | null;
}): Promise<PartneroCustomer | null> {
  const body: Record<string, unknown> = {
    key: input.key,
    email: input.email,
  };
  if (input.name) body.name = input.name.split(" ")[0] ?? input.name;
  const surname = input.name?.split(" ").slice(1).join(" ");
  if (surname) body.surname = surname;
  if (input.referringCustomerKey) {
    body.referring_customer = { key: input.referringCustomerKey };
  }

  const { status, data } = await partneroFetch<PartneroCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (status === 200 || status === 201) return data;
  return null;
}

export async function getPartneroCustomer(key: string): Promise<PartneroCustomer | null> {
  const { status, data } = await partneroFetch<PartneroCustomer>(
    `/customers/${encodeURIComponent(key)}`,
  );
  if (status === 200 && data) return data;
  return null;
}

export async function getPartneroCustomerStats(key: string): Promise<PartneroCustomerStats | null> {
  const { status, data } = await partneroFetch<PartneroCustomerStats>(
    `/customers/${encodeURIComponent(key)}/stats`,
  );
  if (status === 200 && data) return data;
  return null;
}

export async function getPartneroCustomerReferrals(key: string): Promise<PartneroCustomer[]> {
  const { status, data } = await partneroFetch<{ data?: PartneroCustomer[] } | PartneroCustomer[]>(
    `/customers/${encodeURIComponent(key)}/referrals`,
  );
  if (status !== 200 || !data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as { data?: PartneroCustomer[] }).data)) {
    return (data as { data: PartneroCustomer[] }).data;
  }
  return [];
}

/** Record onboarding milestone — triggers Partnero rewards if configured. */
export async function recordPartneroOnboardingTransaction(customerKey: string): Promise<boolean> {
  const { status } = await partneroFetch("/transactions", {
    method: "POST",
    body: JSON.stringify({
      customer: { key: customerKey },
      key: `onboarding-${customerKey}`,
      amount: 1,
      action: "signup",
    }),
  });
  return status === 200 || status === 201;
}

export async function ensurePartneroCustomer(input: {
  userId: string;
  email: string;
  name?: string | null;
  referringCustomerKey?: string | null;
}): Promise<PartneroCustomer | null> {
  if (!partneroEnabled()) return null;

  const key = partneroCustomerKey(input.userId);
  const existing = await getPartneroCustomer(key);
  if (existing) return existing;

  return createPartneroCustomer({
    key,
    email: input.email,
    name: input.name,
    referringCustomerKey: input.referringCustomerKey,
  });
}

export function partneroReferralLink(customer: PartneroCustomer, fallbackKey: string): string {
  const base = resolveAppUrl();
  const link = customer.referral_link ?? customer.referral_links?.[0];
  if (link) return link;
  return `${base}/signup?ref=${encodeURIComponent(customer.key ?? fallbackKey)}`;
}
