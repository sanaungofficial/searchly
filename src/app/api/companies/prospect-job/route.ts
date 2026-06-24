import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { mergeCachedJobs, type CachedJob } from "@/lib/cached-job";
import { fetchHirebaseJobById, isHirebaseConfigured } from "@/lib/hirebase";

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Enrich a watchlist cached job with full Hirebase detail (raw description, skills, etc.). */
export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { job?: CachedJob };
  const job = body.job;
  if (!job?.title?.trim()) {
    return NextResponse.json({ error: "job is required" }, { status: 400 });
  }

  if (!isHirebaseConfigured() || !job.hirebaseId) {
    return NextResponse.json({ job });
  }

  try {
    const detail = await fetchHirebaseJobById(job.hirebaseId);
    if (detail) {
      return NextResponse.json({ job: mergeCachedJobs(job, detail) });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Hirebase request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({ job });
}
