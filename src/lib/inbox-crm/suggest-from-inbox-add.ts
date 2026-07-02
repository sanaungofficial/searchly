import { upsertManualInboxContact, type ManualInboxContactInput } from "@/lib/inbox-crm/manual-contact";

export type SuggestInboxAddContact = {
  email: string;
  name?: string | null;
  company?: string | null;
  notes?: string | null;
};

export async function addSuggestedContactsToNetwork(
  userId: string,
  contacts: SuggestInboxAddContact[],
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const contact of contacts) {
    const email = contact.email?.trim().toLowerCase();
    if (!email) {
      skipped += 1;
      continue;
    }

    const payload: ManualInboxContactInput = {
      email,
      name: contact.name?.trim() || null,
      company: contact.company?.trim() || null,
      notes: contact.notes?.trim() || null,
    };

    const row = await upsertManualInboxContact(userId, payload);
    if (row) added += 1;
    else skipped += 1;
  }

  return { added, skipped };
}
