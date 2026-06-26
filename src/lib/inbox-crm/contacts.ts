import { InboxContactSource, type InboxContact } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NylasEvent, NylasMessage, NylasParticipant } from "@/lib/nylas-inbox";
import { InboxActivityDirection } from "@prisma/client";
import { messageDirection } from "@/lib/inbox-crm/direction";

function normalizeEmail(email: string | null | undefined): string | null {
  return email?.trim().toLowerCase() ?? null;
}

function companyFromDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const personal = new Set([
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "yahoo.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
  ]);
  if (personal.has(domain)) return null;
  const base = domain.split(".")[0] ?? domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function pickCounterparty(
  message: NylasMessage,
  userEmail: string | null | undefined,
  direction: InboxActivityDirection,
): NylasParticipant | null {
  const user = normalizeEmail(userEmail);
  const list =
    direction === InboxActivityDirection.OUTBOUND
      ? [...(message.to ?? []), ...(message.cc ?? [])]
      : message.from ?? [];

  for (const p of list) {
    const email = normalizeEmail(p.email);
    if (!email || (user && email === user)) continue;
    return p;
  }
  return list[0] ?? null;
}

export async function upsertContactFromParticipant(
  userId: string,
  participant: NylasParticipant | null,
): Promise<InboxContact | null> {
  const email = normalizeEmail(participant?.email);
  if (!email) return null;

  const name = participant?.name?.trim() || null;
  const company = companyFromDomain(email);

  return prisma.inboxContact.upsert({
    where: { userId_email: { userId, email } },
    create: {
      userId,
      email,
      name,
      company,
      source: InboxContactSource.EMAIL,
    },
    update: {
      ...(name ? { name } : {}),
      ...(company ? { company } : {}),
    },
  });
}

export async function upsertContactFromMessage(
  userId: string,
  message: NylasMessage,
  userEmail: string | null | undefined,
): Promise<InboxContact | null> {
  const direction = messageDirection(message, userEmail);
  const counterparty = pickCounterparty(message, userEmail, direction);
  return upsertContactFromParticipant(userId, counterparty);
}

export async function upsertContactFromEvent(
  userId: string,
  event: NylasEvent,
  userEmail: string | null | undefined,
): Promise<InboxContact | null> {
  const user = normalizeEmail(userEmail);
  const other =
    event.participants?.find((p) => {
      const email = normalizeEmail(p.email);
      return email && email !== user;
    }) ?? event.participants?.[0] ??
    null;

  return upsertContactFromParticipant(userId, other ?? null);
}
