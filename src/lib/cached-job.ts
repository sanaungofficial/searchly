import type { JobMeta } from "@/lib/job-meta";
import type { KanbanCard } from "@/components/scout/workspace-data";

/** Stored on TrackedCompany.jobsCache JSON — watchlist matches, not pipeline rows. */
export type CachedJob = {
  title: string;
  location: string | null;
  department: string | null;
  url: string | null;
  hirebaseId?: string | null;
  jobSlug?: string | null;
  companySlug?: string | null;
  companyLink?: string | null;
  companyLogo?: string | null;
  description?: string | null;
  jobSummary?: string | null;
  companySummary?: string | null;
  jobType?: string | null;
  remote?: boolean | null;
  seniority?: string | null;
  experienceLevel?: string | null;
  salary?: string | null;
  skills?: string[];
  technologies?: string[];
  benefits?: string[];
  responsibilities?: string[];
  requiredQualifications?: string[];
  preferredQualifications?: string[];
  tags?: string[];
  industries?: string[];
  subindustries?: string[];
  datePosted?: string | null;
  team?: string | null;
  educationLevel?: string | null;
  visaSponsored?: boolean | null;
  jobBoard?: string | null;
};

export function normalizeJobUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${path}${parsed.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

function pickArray(primary?: string[], fallback?: string[]): string[] | undefined {
  if (primary?.length) return primary;
  if (fallback?.length) return fallback;
  return undefined;
}

export function mergeCachedJobs(base: CachedJob, detail: CachedJob): CachedJob {
  const detailDescription = detail.description?.trim() ?? "";
  const baseDescription = base.description?.trim() ?? "";
  const description =
    detailDescription.length >= baseDescription.length ? detail.description ?? base.description ?? null : base.description ?? detail.description ?? null;
  const fullDescription = hasFullJobDescription(description);

  const merged: CachedJob = {
    title: detail.title || base.title,
    location: detail.location ?? base.location,
    department: detail.department ?? base.department,
    url: detail.url ?? base.url,
    hirebaseId: detail.hirebaseId ?? base.hirebaseId ?? null,
    jobSlug: detail.jobSlug ?? base.jobSlug ?? null,
    companySlug: detail.companySlug ?? base.companySlug ?? null,
    companyLink: detail.companyLink ?? base.companyLink ?? null,
    companyLogo: detail.companyLogo ?? base.companyLogo ?? null,
    description,
    jobSummary: detail.jobSummary ?? base.jobSummary ?? null,
    companySummary: detail.companySummary ?? base.companySummary ?? null,
    jobType: detail.jobType ?? base.jobType ?? null,
    remote: detail.remote ?? base.remote ?? null,
    seniority: detail.seniority ?? base.seniority ?? null,
    experienceLevel: detail.experienceLevel ?? base.experienceLevel ?? null,
    salary: detail.salary ?? base.salary ?? null,
    skills: pickArray(detail.skills, base.skills),
    technologies: pickArray(detail.technologies, base.technologies),
    benefits: pickArray(detail.benefits, base.benefits),
    responsibilities: pickArray(detail.responsibilities, base.responsibilities),
    preferredQualifications: pickArray(detail.preferredQualifications, base.preferredQualifications),
    requiredQualifications: fullDescription
      ? (() => {
          const quals = pickArray(detail.requiredQualifications, base.requiredQualifications);
          const filtered = quals?.filter((q) => q.trim() !== (base.jobSummary?.trim() ?? "") && q.trim() !== (detail.jobSummary?.trim() ?? ""));
          return filtered?.length ? filtered : undefined;
        })()
      : pickArray(detail.requiredQualifications, base.requiredQualifications),
    tags: pickArray(detail.tags, base.tags),
    datePosted: detail.datePosted ?? base.datePosted ?? null,
    team: detail.team ?? base.team ?? null,
    educationLevel: detail.educationLevel ?? base.educationLevel ?? null,
    visaSponsored: detail.visaSponsored ?? base.visaSponsored ?? null,
    jobBoard: detail.jobBoard ?? base.jobBoard ?? null,
    industries: pickArray(detail.industries, base.industries),
    subindustries: pickArray(detail.subindustries, base.subindustries),
  };

  if (fullDescription && merged.requiredQualifications?.length === 1 && merged.requiredQualifications[0] === merged.jobSummary?.trim()) {
    merged.requiredQualifications = undefined;
  }

  return merged;
}

function hasFullJobDescription(description: string | null | undefined): boolean {
  return (description?.trim().length ?? 0) >= 200;
}

export function cachedJobToMeta(job: CachedJob): JobMeta {
  const skills = [...(job.skills ?? []), ...(job.technologies ?? [])]
    .map((s) => s.trim())
    .filter(Boolean);
  const uniqueSkills = [...new Set(skills)];

  return {
    location: job.location,
    salary: job.salary ?? null,
    jobType: job.jobType ?? null,
    remote: job.remote ?? null,
    seniority: job.seniority ?? null,
    experienceLevel: job.experienceLevel ?? null,
    description: job.description ?? null,
    jobSummary: job.jobSummary ?? null,
    companySummary: job.companySummary ?? null,
    companySlug: job.companySlug ?? null,
    companyWebsite: job.companyLink ?? null,
    companyLogo: job.companyLogo ?? null,
    responsibilities: job.responsibilities?.length ? job.responsibilities : undefined,
    skills: uniqueSkills.length ? uniqueSkills : undefined,
    requiredQualifications: job.requiredQualifications?.length ? job.requiredQualifications : undefined,
    preferredQualifications: job.preferredQualifications?.length ? job.preferredQualifications : undefined,
    benefits: job.benefits?.length ? job.benefits : undefined,
    tags: job.tags?.length ? job.tags : job.department ? [job.department] : undefined,
    datePosted: job.datePosted ?? null,
    department: job.department ?? null,
    team: job.team ?? null,
    educationLevel: job.educationLevel ?? null,
    visaSponsored: job.visaSponsored ?? null,
    jobBoard: job.jobBoard ?? null,
    industries: job.industries?.length ? job.industries : undefined,
    subindustries: job.subindustries?.length ? job.subindustries : undefined,
  };
}

export function buildProspectKanbanCard(
  companyName: string,
  job: CachedJob,
  drawerId: number
): KanbanCard & { _url?: string; _meta?: JobMeta } {
  return {
    id: drawerId,
    company: companyName,
    initials: companyName.slice(0, 2).toUpperCase(),
    role: job.title,
    stage: "saved",
    fit: 0,
    jobRef: null,
    days: 0,
    _url: job.url ?? undefined,
    _meta: cachedJobToMeta(job),
  };
}

export function findPipelineCardByUrl(
  cards: KanbanCard[],
  url: string | null | undefined
): (KanbanCard & { _dbId?: string; _url?: string }) | null {
  const target = normalizeJobUrl(url);
  if (!target) return null;
  for (const card of cards) {
    const ext = card as KanbanCard & { _url?: string; _dbId?: string };
    if (ext._dbId && normalizeJobUrl(ext._url) === target) return ext;
  }
  return null;
}

export function cachedJobNeedsEnrichment(job: CachedJob): boolean {
  if (!job.hirebaseId) return false;
  return !job.description?.trim() || !job.skills?.length;
}
