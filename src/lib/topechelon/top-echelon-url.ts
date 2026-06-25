import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

const BIG_BILLER_ORIGIN = "https://bigbiller.topechelon.com";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Seed / placeholder UUIDs must not become live Big Biller links. */
const PLACEHOLDER_UUID_RE =
  /^(a1b2c3d4|b2c3d4e5|c3d4e5f6|00000000|12345678|deadbeef)/i;

export function isTopEchelonWebUuid(value: string): boolean {
  return UUID_RE.test(value) && !PLACEHOLDER_UUID_RE.test(value);
}

function readUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isTopEchelonWebUuid(trimmed) ? trimmed : null;
}

function uuidFromUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/\/network\/jobs\/([0-9a-f-]{36})(?:\/info)?/i);
  if (!match?.[1]) return null;
  return readUuid(match[1]);
}

function nestedUuid(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  for (const key of [
    "uuid",
    "id",
    "job_uuid",
    "jobUuid",
    "web_uuid",
    "webUuid",
    "public_id",
    "publicId",
    "network_job_uuid",
    "networkJobUuid",
  ]) {
    const found = readUuid(record[key]);
    if (found) return found;
  }
  for (const key of ["url", "share_url", "shareUrl", "job_url", "jobUrl", "info_url", "infoUrl"]) {
    const fromUrl = uuidFromUrl(record[key]);
    if (fromUrl) return fromUrl;
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

  for (const urlKey of [
    "share_url",
    "shareUrl",
    "job_url",
    "jobUrl",
    "network_url",
    "networkUrl",
    "big_biller_url",
    "bigBillerUrl",
    "top_echelon_url",
    "topEchelonUrl",
    "url",
  ]) {
    const fromUrl = uuidFromUrl(job[urlKey]);
    if (fromUrl) return fromUrl;
  }

  if (typeof job.id === "string") {
    const fromId = readUuid(job.id);
    if (fromId) return fromId;
  }

  for (const nestedKey of [
    "network_posting",
    "networkPosting",
    "network_job",
    "networkJob",
    "ten_feed_posting",
    "tenFeedPosting",
  ]) {
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
