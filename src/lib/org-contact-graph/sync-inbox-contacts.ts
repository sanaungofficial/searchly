import { prisma } from "@/lib/prisma";
import { seedOrgContactKnownBy, upsertOrgContact } from "@/lib/org-contact-graph/upsert";

/** Every org member gets a pooled network source — inbox connect is optional. */
export async function ensurePooledOrgNetworkSource(orgMemberId: string) {
  return prisma.orgNetworkSource.upsert({
    where: { orgMemberId },
    create: {
      orgMemberId,
      visibility: "POOLED",
      status: "DISCONNECTED",
    },
    update: {
      visibility: "POOLED",
    },
  });
}

/** Upsert a member's My Network (InboxContact) rows into the org pooled graph. */
export async function syncOrgMemberInboxContacts(orgMemberId: string) {
  const member = await prisma.orgMember.findUnique({
    where: { id: orgMemberId },
    select: { orgId: true, userId: true },
  });
  if (!member) return { synced: 0, skipped: true as const };

  const source = await ensurePooledOrgNetworkSource(orgMemberId);
  const inboxContacts = await prisma.inboxContact.findMany({
    where: { userId: member.userId },
    select: {
      email: true,
      name: true,
      company: true,
      title: true,
      phone: true,
      linkedinUrl: true,
      lastActivityAt: true,
      updatedAt: true,
    },
  });

  let synced = 0;
  const now = new Date();

  for (const row of inboxContacts) {
    const contact = await upsertOrgContact({
      orgId: member.orgId,
      email: row.email,
      name: row.name,
      company: row.company,
      title: row.title,
      phone: row.phone,
      linkedinUrl: row.linkedinUrl,
      activityAt: row.lastActivityAt ?? row.updatedAt ?? null,
    });
    if (!contact) continue;

    await seedOrgContactKnownBy({
      orgContactId: contact.id,
      networkSourceId: source.id,
      seenAt: row.lastActivityAt ?? row.updatedAt ?? now,
    });
    synced += 1;
  }

  return { synced, skipped: false as const };
}

/** Sync inbox CRM contacts into every org pool the user belongs to. */
export async function syncUserInboxContactsToOrgPools(userId: string) {
  const memberships = await prisma.orgMember.findMany({
    where: { userId },
    select: { id: true },
  });

  let synced = 0;
  for (const membership of memberships) {
    const result = await syncOrgMemberInboxContacts(membership.id);
    synced += result.synced;
  }

  return { orgCount: memberships.length, synced };
}

/** Cron/backfill: sync My Network contacts for all org members. */
export async function syncAllOrgMemberInboxContacts() {
  const members = await prisma.orgMember.findMany({ select: { id: true } });

  let synced = 0;
  let failed = 0;
  for (const member of members) {
    try {
      const result = await syncOrgMemberInboxContacts(member.id);
      synced += result.synced;
    } catch (err) {
      failed += 1;
      console.error("[org-contact-graph] sync inbox contacts", member.id, err);
    }
  }

  return { members: members.length, synced, failed };
}

/** One-time migration helper: force POOLED visibility on all network sources. */
export async function migrateAllOrgNetworkSourcesToPooled() {
  const result = await prisma.orgNetworkSource.updateMany({
    data: { visibility: "POOLED" },
  });
  return { updated: result.count };
}
