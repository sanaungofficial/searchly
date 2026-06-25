import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { interpretNetworkJob, SEED_NETWORK_JOBS } from "@/lib/network-job-display";
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
}) {
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const externalId = decodeURIComponent(jobId);

  try {
    const row = await prisma.networkJob.findFirst({
      where: { externalId },
      include: { recruiterRecord: true },
    });
    if (row) return NextResponse.json({ job: rowToListing(row) });
  } catch {
    // fall through to seed lookup
  }

  const seed = SEED_NETWORK_JOBS.find((j) => j.id === externalId || j.externalId === externalId);
  if (seed) return NextResponse.json({ job: seed });

  return NextResponse.json({ error: "Job not found" }, { status: 404 });
}
