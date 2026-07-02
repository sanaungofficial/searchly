import { InboxContactSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createNylasContact,
  fetchAllNylasContacts,
  lookupNylasContactByEmail,
  nylasContactDisplayName,
  nylasContactPrimaryEmail,
} from "@/lib/nylas-contacts";
import { syncUserInboxContactsToOrgPools } from "@/lib/org-contact-graph/sync-inbox-contacts";

function mergeContactFields(
  existing: { name: string | null; company: string | null; title: string | null },
  incoming: { name: string | null; company: string | null; title: string | null },
) {
  return {
    name: incoming.name || existing.name,
    company: incoming.company || existing.company,
    title: incoming.title || existing.title,
  };
}

export async function upsertInboxContactFromNylas(
  userId: string,
  params: {
    email: string;
    name?: string | null;
    company?: string | null;
    title?: string | null;
    nylasContactId?: string | null;
  },
) {
  const email = params.email.trim().toLowerCase();
  if (!email) return null;

  const existing = await prisma.inboxContact.findUnique({
    where: { userId_email: { userId, email } },
  });

  const incoming = {
    name: params.name?.trim() || null,
    company: params.company?.trim() || null,
    title: params.title?.trim() || null,
  };

  if (existing) {
    const merged = mergeContactFields(existing, incoming);
    const updated = await prisma.inboxContact.update({
      where: { id: existing.id },
      data: {
        ...merged,
        ...(params.nylasContactId ? { nylasContactId: params.nylasContactId, source: InboxContactSource.NYLAS } : {}),
      },
    });
    syncUserInboxContactsToOrgPools(userId).catch((err) =>
      console.error("[inbox-crm] org pool sync after nylas upsert", userId, err),
    );
    return updated;
  }

  const created = await prisma.inboxContact.create({
    data: {
      userId,
      email,
      ...incoming,
      nylasContactId: params.nylasContactId ?? null,
      source: params.nylasContactId ? InboxContactSource.NYLAS : InboxContactSource.EMAIL,
    },
  });
  syncUserInboxContactsToOrgPools(userId).catch((err) =>
    console.error("[inbox-crm] org pool sync after nylas create", userId, err),
  );
  return created;
}

export async function syncNylasContactsForUser(userId: string) {
  const grant = await prisma.userEmailGrant.findUnique({ where: { userId } });
  if (!grant) return { synced: 0, skipped: true };

  let synced = 0;
  try {
    const contacts = await fetchAllNylasContacts(grant.nylasGrantId, 15);
    for (const row of contacts) {
      const email = nylasContactPrimaryEmail(row);
      if (!email) continue;
      await upsertInboxContactFromNylas(userId, {
        email,
        name: nylasContactDisplayName(row),
        company: row.company_name ?? null,
        title: row.job_title ?? null,
        nylasContactId: row.id,
      });
      synced += 1;
    }
  } catch (err) {
    console.error("[inbox-crm] nylas contacts sync", userId, err);
    throw err;
  }

  return { synced, skipped: false };
}

export async function saveInboxContactToNylas(userId: string, contactId: string) {
  const grant = await prisma.userEmailGrant.findUnique({ where: { userId } });
  if (!grant) throw new Error("INBOX_NOT_CONNECTED");

  const contact = await prisma.inboxContact.findFirst({ where: { id: contactId, userId } });
  if (!contact) throw new Error("CONTACT_NOT_FOUND");

  if (contact.nylasContactId) return contact;

  const existing = await lookupNylasContactByEmail(grant.nylasGrantId, contact.email);
  if (existing) {
    return prisma.inboxContact.update({
      where: { id: contact.id },
      data: {
        nylasContactId: existing.id,
        source: InboxContactSource.NYLAS,
        name: nylasContactDisplayName(existing) ?? contact.name,
        company: existing.company_name ?? contact.company,
        title: existing.job_title ?? contact.title,
      },
    });
  }

  const created = await createNylasContact(grant.nylasGrantId, {
    email: contact.email,
    name: contact.name,
    company: contact.company,
    title: contact.title,
  });
  if (!created) throw new Error("NYLAS_SAVE_FAILED");

  return prisma.inboxContact.update({
    where: { id: contact.id },
    data: {
      nylasContactId: created.id,
      source: InboxContactSource.NYLAS,
      name: nylasContactDisplayName(created) ?? contact.name,
      company: created.company_name ?? contact.company,
      title: created.job_title ?? contact.title,
    },
  });
}

export async function syncAllNylasContacts() {
  const grants = await prisma.userEmailGrant.findMany();
  let total = 0;
  for (const grant of grants) {
    try {
      const { synced } = await syncNylasContactsForUser(grant.userId);
      total += synced;
    } catch (err) {
      console.error("[inbox-crm] contacts cron", grant.userId, err);
    }
  }
  return { users: grants.length, synced: total };
}
