import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

/** Read the first present key from a raw TE job without transforming the value. */
export function rawField(job: TopEchelonNetworkJobRaw, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = job[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

export function rawFieldString(job: TopEchelonNetworkJobRaw, ...keys: string[]): string | null {
  const value = rawField(job, ...keys);
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export function rawJobId(job: TopEchelonNetworkJobRaw): string {
  return String(job.id);
}

/** Keys TE uses for long-form HTML entered by recruiters — render as HTML, not plain text. */
export const TE_HTML_FIELD_KEYS = new Set(["description", "comments", "share_note", "shareNote"]);

export function isLikelyHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

/** All top-level keys on the detail payload, stable order: TE document fields first, then alpha. */
const TE_FIELD_ORDER = [
  "position_title",
  "positionTitle",
  "network_id",
  "networkId",
  "network_status",
  "networkStatus",
  "city",
  "state",
  "minimum_compensation",
  "minimumCompensation",
  "maximum_compensation",
  "maximumCompensation",
  "fee",
  "fee_type",
  "feeType",
  "job_type",
  "jobType",
  "remote_option",
  "remoteOption",
  "description",
  "comments",
  "share_note",
  "shareNote",
  "most_recently_shared_at",
  "mostRecentlySharedAt",
  "recruiter",
  "agency_detail",
  "agencyDetail",
  "network_posting",
  "networkPosting",
  "ten_feed_posting",
  "tenFeedPosting",
  "created_by",
  "createdBy",
  "updated_by",
  "updatedBy",
  "guarantee",
  "guarantee_period",
  "guaranteePeriod",
  "industries",
  "id",
];

export function orderedRawFieldEntries(job: TopEchelonNetworkJobRaw): Array<[string, unknown]> {
  const keys = Object.keys(job).filter((k) => job[k] !== undefined);
  const rank = new Map(TE_FIELD_ORDER.map((k, i) => [k, i]));
  keys.sort((a, b) => {
    const ra = rank.get(a) ?? 999;
    const rb = rank.get(b) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
  return keys.map((k) => [k, job[k]]);
}

export function formatRawFieldLabel(key: string): string {
  return key;
}
