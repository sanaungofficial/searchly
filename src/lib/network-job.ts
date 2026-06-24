import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";
import { SEED_RAW_NETWORK_JOBS } from "@/lib/network-job-seed-raw";
import { rawFieldString, rawJobId } from "@/lib/network-job-raw-display";

/** UI handle for a network job — detail payload is stored verbatim in `raw`. */
export type NetworkJobListing = {
  id: string;
  raw: TopEchelonNetworkJobRaw;
};

export function listingFromRaw(raw: TopEchelonNetworkJobRaw): NetworkJobListing {
  return { id: rawJobId(raw), raw };
}

/** Card preview only: strip HTML tags so list rows stay scannable. Drawer shows raw HTML. */
export function previewPlainText(value: string | null | undefined, maxLen = 160): string {
  if (!value) return "";
  const plain = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen).trim()}…`;
}

export const SEED_NETWORK_JOBS: NetworkJobListing[] = SEED_RAW_NETWORK_JOBS.map(listingFromRaw);

/** Values read directly from TE fields for list cards — no formatting. */
export function cardTitle(job: NetworkJobListing): string {
  return rawFieldString(job.raw, "position_title", "positionTitle") ?? "Untitled role";
}

export function cardNetworkId(job: NetworkJobListing): string | null {
  return rawFieldString(job.raw, "network_id", "networkId");
}

export function cardSharedAt(job: NetworkJobListing): string | null {
  return rawFieldString(job.raw, "most_recently_shared_at", "mostRecentlySharedAt");
}

export function cardAgencyName(job: NetworkJobListing): string | null {
  const agency = job.raw.agency_detail ?? job.raw.agencyDetail;
  if (!agency || typeof agency !== "object") return null;
  const a = agency as Record<string, unknown>;
  return (
    (typeof a.name === "string" ? a.name : null) ??
    (typeof a.company_name === "string" ? a.company_name : null) ??
    (typeof a.companyName === "string" ? a.companyName : null)
  );
}

export function cardRecruiterLabel(job: NetworkJobListing): string | null {
  const r = job.raw.recruiter;
  if (!r || typeof r !== "object") return null;
  const rec = r as Record<string, unknown>;
  if (typeof rec.name === "string" && rec.name.trim()) return rec.name;
  const parts = [rec.first_name ?? rec.firstName, rec.last_name ?? rec.lastName]
    .filter((p) => typeof p === "string" && p.trim())
    .map((p) => (p as string).trim());
  return parts.length ? parts.join(" ") : null;
}

export function cardDescriptionPreview(job: NetworkJobListing): string {
  return previewPlainText(rawFieldString(job.raw, "description"));
}

export function cardLocationParts(job: NetworkJobListing): string[] {
  const parts: string[] = [];
  const city = rawFieldString(job.raw, "city");
  if (city) parts.push(city);
  const state = job.raw.state;
  if (typeof state === "string" && state.trim()) {
    parts.push(state);
  } else if (state && typeof state === "object") {
    const s = state as Record<string, unknown>;
    const abbrev = typeof s.abbreviation === "string" ? s.abbreviation : null;
    const name = typeof s.name === "string" ? s.name : null;
    if (abbrev) parts.push(abbrev);
    else if (name) parts.push(name);
  }
  return parts;
}

export function cardCompensationLabel(job: NetworkJobListing): string | null {
  const min = job.raw.minimum_compensation ?? job.raw.minimumCompensation;
  const max = job.raw.maximum_compensation ?? job.raw.maximumCompensation;
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min} – ${max}`;
  return String(min ?? max);
}
