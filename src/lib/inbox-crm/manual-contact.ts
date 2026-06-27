import { InboxContactSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ManualInboxContactInput = {
  email: string;
  name?: string | null;
  company?: string | null;
  title?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
  contacted?: boolean | null;
};

function mergeOptional<T>(incoming: T | null | undefined, existing: T | null): T | null {
  if (incoming === undefined) return existing;
  if (typeof incoming === "string") {
    const trimmed = incoming.trim();
    return trimmed ? trimmed : existing;
  }
  return incoming ?? existing;
}

/** Create or update an inbox CRM contact without Nylas / email sync. */
export async function upsertManualInboxContact(userId: string, input: ManualInboxContactInput) {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const existing = await prisma.inboxContact.findUnique({
    where: { userId_email: { userId, email } },
  });

  const payload = {
    name: mergeOptional(input.name?.trim() || null, existing?.name ?? null),
    company: mergeOptional(input.company?.trim() || null, existing?.company ?? null),
    title: mergeOptional(input.title?.trim() || null, existing?.title ?? null),
    linkedinUrl: mergeOptional(input.linkedinUrl?.trim() || null, existing?.linkedinUrl ?? null),
    notes: mergeOptional(input.notes?.trim() || null, existing?.notes ?? null),
    contacted:
      input.contacted === undefined || input.contacted === null
        ? existing?.contacted ?? null
        : input.contacted,
  };

  if (existing) {
    return prisma.inboxContact.update({
      where: { id: existing.id },
      data: { ...payload, source: InboxContactSource.MANUAL },
    });
  }

  return prisma.inboxContact.create({
    data: {
      userId,
      email,
      ...payload,
      source: InboxContactSource.MANUAL,
    },
  });
}
