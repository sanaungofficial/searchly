import { NextResponse } from "next/server";
import { loadNetworkJobListings } from "@/lib/network-jobs-load";

export async function GET() {
  const { jobs, source } = await loadNetworkJobListings();
  return NextResponse.json({
    jobs,
    source,
    count: jobs.length,
  });
}
