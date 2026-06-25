/** Airtable view: contract sent · onboarding email sent · active (~20 coaches). */
export const AIRTABLE_COACHES_VIEW_ID = "viwWT4NLjApfCSy6m";

/** Status values on MBB/Big 4 Mentors that Kimchi should sync. */
export const AIRTABLE_COACH_SYNC_STATUSES = [
  "contract sent",
  "onboarding email sent",
  "active",
] as const;

export type AirtableCoachSyncStatus = (typeof AIRTABLE_COACH_SYNC_STATUSES)[number];

/** Airtable REST API filter — combined with the synced view for defense in depth. */
export const AIRTABLE_COACH_SYNC_FILTER_FORMULA = `OR({Status}='contract sent',{Status}='onboarding email sent',{Status}='active')`;

export function isAllowedAirtableCoachSyncStatus(value: unknown): boolean {
  if (value == null) return false;
  let name: string | null = null;
  if (typeof value === "string") name = value.trim().toLowerCase();
  else if (typeof value === "object" && "name" in value) {
    name = String((value as { name: string }).name).trim().toLowerCase();
  }
  if (!name) return false;
  return AIRTABLE_COACH_SYNC_STATUSES.some((s) => s === name);
}
