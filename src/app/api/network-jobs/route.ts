import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { interpretNetworkJob, SEED_NETWORK_JOBS, type NetworkJobListing } from "@/lib/network-job-display";
import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

function rowToListing(row: {
  externalId: string;
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
  }
  return listing;
}

export async function GET() {
  try {
    const rows = await prisma.networkJob.findMany({
      include: { recruiterRecord: true },
      orderBy: { sharedAt: "desc" },
      take: 200,
    });

    if (rows.length > 0) {
      return NextResponse.json({
        jobs: rows.map(rowToListing),
        source: "database",
        count: rows.length,
      });
    }
  } catch (err) {
    console.warn("[network-jobs] DB read failed, using seed:", err);
  }

  return NextResponse.json({
    jobs: SEED_NETWORK_JOBS,
    source: "seed",
    count: SEED_NETWORK_JOBS.length,
  });
}
