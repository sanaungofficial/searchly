import { cachedJobToMeta, jobListingUrlDedupeKey, type CachedJob } from "@/lib/cached-job";
import {
  fetchHirebaseCompanyJobs,
  fetchHirebaseJobById,
  fetchHirebaseMatchingJobs,
  isHirebaseConfigured,
} from "@/lib/hirebase";
import type { JobMeta } from "@/lib/job-meta";
import { normalizeImportJobUrl } from "@/lib/client-import/job-url";

const companyJobsCache = new Map<string, Promise<CachedJob[]>>();

function pickBestJobMatch(jobs: CachedJob[], url: string | null, role: string): CachedJob | null {
  if (!jobs.length) return null;

  if (url?.trim()) {
    const targetKey = jobListingUrlDedupeKey({ url });
    const byKey = jobs.find(
      (job) => jobListingUrlDedupeKey({ url: job.url, hirebaseId: job.hirebaseId }) === targetKey,
    );
    if (byKey) return byKey;

    const importKey = normalizeImportJobUrl(url);
    if (importKey) {
      const byImportUrl = jobs.find((job) => normalizeImportJobUrl(job.url) === importKey);
      if (byImportUrl) return byImportUrl;
    }
  }

  const roleNorm = role.trim().toLowerCase();
  const byTitle = jobs.find((job) => job.title.trim().toLowerCase() === roleNorm);
  if (byTitle) return byTitle;

  const partial = jobs.find((job) => {
    const title = job.title.trim().toLowerCase();
    return title.includes(roleNorm) || roleNorm.includes(title);
  });
  return partial ?? jobs[0] ?? null;
}

async function companyJobsForImport(company: string, hirebaseSlug?: string | null): Promise<CachedJob[]> {
  const key = `${company.toLowerCase()}::${hirebaseSlug ?? ""}`;
  if (!companyJobsCache.has(key)) {
    companyJobsCache.set(
      key,
      fetchHirebaseCompanyJobs({
        companyName: company,
        slugHint: hirebaseSlug,
        maxJobs: 120,
        pageSize: 100,
      })
        .then((result) => result.jobs)
        .catch((err) => {
          console.warn("[companyJobsForImport]", company, err);
          return [] as CachedJob[];
        }),
    );
  }
  return companyJobsCache.get(key)!;
}

async function hydrateFullPosting(job: CachedJob): Promise<CachedJob> {
  const needsFull =
    job.hirebaseId?.trim() &&
    (!job.description?.trim() || job.description.trim().length < 200);
  if (!needsFull || !job.hirebaseId) return job;

  try {
    const full = await fetchHirebaseJobById(job.hirebaseId);
    return full?.job ?? job;
  } catch {
    return job;
  }
}

/** Resolve Hirebase posting metadata for an imported pipeline job (URL preferred). */
export async function enrichImportJobPosting(input: {
  company: string;
  role: string;
  url: string | null;
  hirebaseSlug?: string | null;
}): Promise<{ notes: string | null; enriched: boolean }> {
  if (!isHirebaseConfigured()) return { notes: null, enriched: false };

  const company = input.company.trim();
  const role = input.role.trim();
  if (!company || !role) return { notes: null, enriched: false };

  try {
    let jobs = await companyJobsForImport(company, input.hirebaseSlug);
    let match = pickBestJobMatch(jobs, input.url, role);

    if (!match) {
      const targeted = await fetchHirebaseMatchingJobs({
        companyName: company,
        hirebaseSlug: input.hirebaseSlug,
        jobTitles: [role],
        maxJobs: 12,
      });
      jobs = targeted.jobs;
      match = pickBestJobMatch(jobs, input.url, role);
    }

    if (!match) return { notes: null, enriched: false };

    const hydrated = await hydrateFullPosting(match);
    const meta = cachedJobToMeta(hydrated);
    const descriptionText = meta.description?.trim() || meta.jobSummary?.trim() || "";
    if (descriptionText.length < 40) return { notes: null, enriched: false };

    return { notes: JSON.stringify(meta), enriched: true };
  } catch (err) {
    console.warn("[enrichImportJobPosting]", company, role, err);
    return { notes: null, enriched: false };
  }
}

export function parseJobMetaFromNotes(notes: string | null | undefined): JobMeta | null {
  if (!notes?.trim()) return null;
  try {
    const parsed = JSON.parse(notes) as JobMeta;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function jobNotesNeedDescription(notes: string | null | undefined): boolean {
  const meta = parseJobMetaFromNotes(notes);
  if (!meta) return true;
  const text = meta.description?.trim() || meta.jobSummary?.trim() || "";
  return text.length < 120;
}

export function clearImportJobPostingCache() {
  companyJobsCache.clear();
}
