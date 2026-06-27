import { prisma } from "@/lib/prisma";
import {
  interpretExecThreadJob,
  interpretNetworkJob,
  SEED_NETWORK_JOBS,
  type NetworkJobListing,
} from "@/lib/network-job-display";
import type { ExecThreadListingRaw } from "@/lib/execthread/types";
import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";
import type { NetworkJobSource } from "@prisma/client";

function rowToListing(row: {
  source: NetworkJobSource;
  externalId: string;
  topEchelonUrl: string | null;
  sourceUrl: string | null;
  raw: unknown;
  recruiterRecord: {
    externalId: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    agencyName: string | null;
  } | null;
}): NetworkJobListing {
  const listing =
    row.source === "EXECTHREAD"
      ? interpretExecThreadJob(row.raw as ExecThreadListingRaw)
      : interpretNetworkJob(row.raw as TopEchelonNetworkJobRaw);

  if (row.topEchelonUrl) listing.topEchelonUrl = row.topEchelonUrl;
  if (row.sourceUrl) listing.sourceUrl = row.sourceUrl;

  if (row.recruiterRecord && row.source === "TOPECHELON") {
    listing.recruiter = {
      id: row.recruiterRecord.externalId,
      externalId: row.recruiterRecord.externalId,
      name: row.recruiterRecord.name ?? "Unknown recruiter",
      firstName: row.recruiterRecord.firstName,
      lastName: row.recruiterRecord.lastName,
      email: row.recruiterRecord.email,
      phone: row.recruiterRecord.phone,
      agencyName: row.recruiterRecord.agencyName,
    };
    if (row.recruiterRecord.agencyName && !listing.agencyName) {
      listing.agencyName = row.recruiterRecord.agencyName;
    }
  }
  return listing;
}

export async function loadNetworkJobListings(): Promise<{
  jobs: NetworkJobListing[];
  source: "database" | "seed";
}> {
  try {
    const rows = await prisma.networkJob.findMany({
      include: { recruiterRecord: true },
      orderBy: { sharedAt: "desc" },
    });

    if (rows.length > 0) {
      return {
        jobs: rows.map(rowToListing),
        source: "database",
      };
    }
  } catch (err) {
    console.warn("[network-jobs] DB read failed, using seed:", err);
  }

  return {
    jobs: SEED_NETWORK_JOBS,
    source: "seed",
  };
}

export async function loadNetworkJobListingById(externalId: string): Promise<NetworkJobListing | null> {
  try {
    const row = await prisma.networkJob.findFirst({
      where: { externalId },
      include: { recruiterRecord: true },
    });
    if (row) return rowToListing(row);
  } catch {
    // fall through
  }

  return (
    SEED_NETWORK_JOBS.find((j) => j.id === externalId || j.externalId === externalId) ?? null
  );
}

export type NetworkJobCatalogFilters = {
  source?: NetworkJobSource;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type NetworkJobCatalogStats = {
  total: number;
  execthread: number;
  topechelon: number;
};

export async function getNetworkJobCatalogStats(): Promise<NetworkJobCatalogStats> {
  const [total, execthread, topechelon] = await Promise.all([
    prisma.networkJob.count(),
    prisma.networkJob.count({ where: { source: "EXECTHREAD" } }),
    prisma.networkJob.count({ where: { source: "TOPECHELON" } }),
  ]);
  return { total, execthread, topechelon };
}

function catalogSearchWhere(source?: NetworkJobSource, q?: string) {
  const trimmed = q?.trim();
  const searchClause = trimmed
    ? {
        OR: [
          { positionTitle: { contains: trimmed, mode: "insensitive" as const } },
          { companyName: { contains: trimmed, mode: "insensitive" as const } },
          { location: { contains: trimmed, mode: "insensitive" as const } },
          { networkId: { contains: trimmed, mode: "insensitive" as const } },
          { externalId: { contains: trimmed, mode: "insensitive" as const } },
          { recruiterName: { contains: trimmed, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  if (source && searchClause) {
    return { source, ...searchClause };
  }
  if (source) return { source };
  if (searchClause) return searchClause;
  return {};
}

export async function loadNetworkJobCatalog(filters: NetworkJobCatalogFilters = {}): Promise<{
  jobs: NetworkJobListing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const where = catalogSearchWhere(filters.source, filters.q);

  const [total, rows] = await Promise.all([
    prisma.networkJob.count({ where }),
    prisma.networkJob.findMany({
      where,
      include: { recruiterRecord: true },
      orderBy: [{ syncedAt: "desc" }, { sharedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    jobs: rows.map(rowToListing),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
