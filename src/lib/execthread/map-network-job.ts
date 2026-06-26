import type { ExecThreadListingRaw } from "@/lib/execthread/types";
import { execThreadListingUrl, resolveExecThreadExternalId } from "@/lib/execthread/execthread-url";

function locationFromJob(job: ExecThreadListingRaw): { city: string | null; state: string | null; location: string | null; remoteOption: string | null } {
  const loc = job.locationInfo?.[0];
  const city = loc?.city ?? loc?.areaDisplayName?.split(",")?.[0]?.trim() ?? null;
  const state = loc?.state ?? null;
  const parts = [city, state, loc?.country].filter(Boolean);
  const location = parts.length ? parts.join(", ") : loc?.areaDisplayName ?? null;

  let remoteOption: string | null = null;
  if (job.isRemote || loc?.isRemote) remoteOption = "Remote";
  else if (job.isHybrid || loc?.isHybrid) remoteOption = "Hybrid";
  else if (job.isOnsite) remoteOption = "On-site";

  return { city, state, location, remoteOption };
}

function companyName(job: ExecThreadListingRaw): string | null {
  const c = job.company;
  if (!c || typeof c !== "object") return null;
  if (typeof c.name === "string" && c.name.trim()) return c.name.trim();
  return null;
}

function industries(job: ExecThreadListingRaw): string[] {
  const out: string[] = [];
  const c = job.company;
  if (c && typeof c === "object") {
    if (typeof c.industry === "string" && c.industry.trim()) out.push(c.industry.trim());
    if (typeof c.type === "string" && c.type.trim()) out.push(c.type.trim());
  }
  return out;
}

function sharedAt(job: ExecThreadListingRaw): Date | null {
  const raw = job.mostRecentlySubmittedDate ?? job.received_date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapExecThreadNetworkJob(job: ExecThreadListingRaw) {
  const { city, state, location, remoteOption } = locationFromJob(job);
  const externalId = resolveExecThreadExternalId(job);
  const funcNames = (job.funcs ?? []).map((f) => f.name).filter(Boolean).join(", ");

  return {
    externalId,
    source: "EXECTHREAD" as const,
    networkId: job.slug ?? null,
    positionTitle: job.title?.trim() || "Untitled role",
    companyName: companyName(job),
    agencyName: companyName(job),
    city,
    state,
    location,
    minimumCompensation: null as number | null,
    maximumCompensation: null as number | null,
    fee: null as string | null,
    feeType: null as string | null,
    jobType: job.jobType ?? job.type ?? null,
    remoteOption,
    description: job.jobDescription ?? job.companyDescription ?? null,
    comments: null as string | null,
    networkStatus: job.level ?? null,
    recruiterName: null as string | null,
    recruiterId: null as string | null,
    topEchelonUrl: null as string | null,
    sourceUrl: execThreadListingUrl(job),
    sharedAt: sharedAt(job),
    raw: job as object,
    syncedAt: new Date(),
    _display: {
      industries: industries(job),
      functions: funcNames || null,
      hasCompensation: Boolean(job.compensation),
    },
  };
}

/** Prisma-safe row for NetworkJob upsert. */
export function toExecThreadNetworkJobDbRecord(job: ExecThreadListingRaw) {
  const mapped = mapExecThreadNetworkJob(job);
  return {
    source: mapped.source,
    externalId: mapped.externalId,
    networkId: mapped.networkId,
    positionTitle: mapped.positionTitle,
    companyName: mapped.companyName,
    city: mapped.city,
    state: mapped.state,
    location: mapped.location,
    minimumCompensation: mapped.minimumCompensation,
    maximumCompensation: mapped.maximumCompensation,
    fee: mapped.fee,
    feeType: mapped.feeType,
    jobType: mapped.jobType,
    remoteOption: mapped.remoteOption,
    description: mapped.description,
    comments: mapped.comments,
    networkStatus: mapped.networkStatus,
    recruiterName: mapped.recruiterName,
    recruiterId: mapped.recruiterId,
    topEchelonUrl: mapped.topEchelonUrl,
    sourceUrl: mapped.sourceUrl,
    sharedAt: mapped.sharedAt,
    raw: mapped.raw,
    syncedAt: mapped.syncedAt,
  };
}

export type MappedExecThreadNetworkJob = ReturnType<typeof mapExecThreadNetworkJob>;
