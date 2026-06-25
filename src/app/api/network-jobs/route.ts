import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import {
  canViewNetworkJobInternalFromSession,
  sanitizeNetworkJobListing,
} from "@/lib/network-job-access";
import { loadNetworkJobListings } from "@/lib/network-jobs-load";

export async function GET(request: Request) {
  const { jobs, source } = await loadNetworkJobListings();
  const { realDbUser, isImpersonating } = await getActingUser(request);
  const internalView = canViewNetworkJobInternalFromSession(
    realDbUser,
    realDbUser?.role === "ADMIN",
    isImpersonating
  );

  const visibleJobs = internalView ? jobs : jobs.map((job) => sanitizeNetworkJobListing(job, false));

  return NextResponse.json({
    jobs: visibleJobs,
    source,
    count: visibleJobs.length,
  });
}
