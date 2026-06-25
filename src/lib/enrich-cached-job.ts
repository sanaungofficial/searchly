import { mergeCachedJobs, type CachedJob } from "@/lib/cached-job";
import { fetchHirebaseJobById, isHirebaseConfigured } from "@/lib/hirebase";

/** Load full Hirebase posting (raw description + skills) when we have a job id. */
export async function enrichCachedJobFromHirebase(job: CachedJob): Promise<CachedJob> {
  if (!isHirebaseConfigured() || !job.hirebaseId?.trim()) {
    return job;
  }

  const detail = await fetchHirebaseJobById(job.hirebaseId.trim());
  if (!detail) return job;
  return mergeCachedJobs(job, detail.job);
}
