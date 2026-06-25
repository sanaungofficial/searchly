import { updateAirtableCoachRecord, isAirtablePushEnabled } from "@/lib/airtable/client";
import { mapCoachToAirtableFields } from "@/lib/airtable/field-map";
import { prisma } from "@/lib/prisma";

/** Push Kimchi coach profile changes to linked Airtable record (when enabled). */
export async function pushCoachProfileToAirtable(coachProfileId: string): Promise<boolean> {
  if (!isAirtablePushEnabled()) return false;

  const profile = await prisma.coachProfile.findUnique({ where: { id: coachProfileId } });
  if (!profile?.airtableId) return false;

  const fields = mapCoachToAirtableFields(profile);
  await updateAirtableCoachRecord(profile.airtableId, fields);
  return true;
}
