import { prisma } from "@/lib/prisma";
import { interpretNetworkJob, SEED_NETWORK_JOBS, type NetworkJobListing } from "@/lib/network-job-display";
import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

function rowToListing(row: {
  externalId: string;
  topEchelonUrl: string | null;
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
  const listing = interpretNetworkJob(row.raw as TopEchelonNetworkJobRaw);
  if (row.topEchelonUrl) listing.topEchelonUrl = row.topEchelonUrl;
  if (row.recruiterRecord) {
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
