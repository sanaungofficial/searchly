import type { OrgNetworkSource } from "@prisma/client";
import {
  fetchAllNylasContacts,
  nylasContactDisplayName,
  nylasContactPrimaryEmail,
} from "@/lib/nylas-contacts";
import { seedOrgContactKnownBy, upsertOrgContact } from "@/lib/org-contact-graph/upsert";

type SyncableOrgNetworkSource = OrgNetworkSource & {
  orgMember: { orgId: string };
};

export async function syncOrgNetworkSourceContacts(source: SyncableOrgNetworkSource) {
  if (!source.nylasGrantId) return { synced: 0, skipped: true as const };

  let synced = 0;
  const contacts = await fetchAllNylasContacts(source.nylasGrantId, 15);
  const now = new Date();

  for (const row of contacts) {
    const email = nylasContactPrimaryEmail(row);
    if (!email) continue;

    const contact = await upsertOrgContact({
      orgId: source.orgMember.orgId,
      email,
      name: nylasContactDisplayName(row),
      company: row.company_name ?? null,
      title: row.job_title ?? null,
      phone: row.phone_numbers?.[0]?.number ?? null,
    });
    if (!contact) continue;

    await seedOrgContactKnownBy({
      orgContactId: contact.id,
      networkSourceId: source.id,
      seenAt: now,
    });
    synced += 1;
  }

  return { synced, skipped: false as const };
}
