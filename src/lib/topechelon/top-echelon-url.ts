import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

const BIG_BILLER_ORIGIN = "https://bigbiller.topechelon.com";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isTopEchelonWebUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function readUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isTopEchelonWebUuid(trimmed) ? trimmed : null;
}

function nestedUuid(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  for (const key of ["uuid", "id", "job_uuid", "jobUuid", "web_uuid", "webUuid"]) {
    const found = readUuid(record[key]);
    if (found) return found;
  }
  return null;
}

/** Big Biller SPA uses a UUID slug — not the numeric TE API id. */
export function resolveTopEchelonJobWebUuid(job: TopEchelonNetworkJobRaw): string | null {
  const directKeys = [
    "uuid",
    "job_uuid",
    "jobUuid",
    "network_job_uuid",
    "networkJobUuid",
    "public_id",
    "publicId",
    "web_uuid",
    "webUuid",
  ];

  for (const key of directKeys) {
    const found = readUuid(job[key]);
    if (found) return found;
  }

  if (typeof job.id === "string") {
    const fromId = readUuid(job.id);
    if (fromId) return fromId;
  }

  for (const nestedKey of ["network_posting", "networkPosting", "network_job", "networkJob"]) {
    const found = nestedUuid(job[nestedKey]);
    if (found) return found;
  }

  return null;
}

/** e.g. https://bigbiller.topechelon.com/network/jobs/{uuid}/info */
export function topEchelonNetworkJobUrl(job: TopEchelonNetworkJobRaw): string | null {
  const webUuid = resolveTopEchelonJobWebUuid(job);
  if (!webUuid) return null;
  return `${BIG_BILLER_ORIGIN}/network/jobs/${webUuid}/info`;
}
