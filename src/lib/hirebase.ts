import { hostnameFromUrl } from "@/lib/company-domain";
import type { CachedJob } from "@/lib/cached-job";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { roleSearchKeywords, isJobMatch } from "@/lib/job-match";
import { formatHirebaseErrorBody } from "@/lib/api-error-message";
import { trimVSearchQuery } from "@/lib/profile-vsearch-query";
import { parseJobDescriptionSections, hasParsedJobSections } from "@/lib/job-description-parse";
import { logHirebaseApiCall } from "@/lib/external-api-usage";

const HIREBASE_BASE = "https://api.hirebase.org";

type HirebaseCompanyData = {
  description_summary?: string | null;
  linkedin_link?: string | null;
  size_range?: { min?: number; max?: number } | null;
  industries?: string[];
  subindustries?: string[];
  services?: string[];
  type?: string | null;
  is_recruiting_agency?: boolean | null;
  is_3rd_party_agency?: boolean | null;
};

export type HirebaseJob = {
  _id?: string;
  job_title?: string;
  job_title_raw?: string;
  title?: string;
  application_link?: string;
  job_categories?: string[];
  locations?: Array<{ city?: string; region?: string; country?: string }>;
  location_type?: string;
  location_raw?: string | null;
  company_name?: string;
  company_slug?: string;
  company_link?: string;
  company_logo?: string | null;
  job_board?: string;
  job_board_link?: string;
  job_slug?: string;
  description?: string | null;
  description_raw?: string | null;
  job_type?: string | null;
  experience_level?: string | null;
  yoe_range?: { min?: number; max?: number } | null;
  salary_range?: { min?: number; max?: number; currency?: string; period?: string } | null;
  requirements_summary?: string | null;
  skills?: string[];
  technologies?: string[];
  benefits?: string[];
  education_level?: string | null;
  team?: string | null;
  date_posted?: string | null;
  visa_sponsored?: boolean | null;
  offers_equity?: boolean | null;
  recruiter_agency?: boolean | null;
  language?: string | null;
  company_data?: HirebaseCompanyData | null;
};

export type HirebaseCompany = {
  company_name?: string;
  company_slug?: string;
  slug?: string;
  total_jobs?: number;
  company_logo?: string | null;
  company_link?: string | null;
  linkedin_link?: string | null;
  description_summary?: string | null;
  job_board?: string | null;
  size_range?: { min?: number; max?: number } | null;
  industries?: string[];
  subindustries?: string[];
  services?: string[];
  type?: string | null;
  is_recruiting_agency?: boolean | null;
  is_3rd_party_agency?: boolean | null;
};

export type HirebaseCompanyProfileRole = {
  title: string;
  location: string | null;
  url: string | null;
};

export type HirebaseCompanyProfile = {
  company_slug: string;
  company_name: string;
  company_logo: string | null;
  company_link: string | null;
  linkedin_link: string | null;
  description_summary: string | null;
  job_board: string | null;
  size_range: { min?: number; max?: number } | null;
  industries: string[];
  subindustries: string[];
  services: string[];
  company_type: string | null;
  is_recruiting_agency: boolean | null;
  is_third_party_agency: boolean | null;
  sample_open_jobs: number;
  sample_roles: HirebaseCompanyProfileRole[];
};

type GetCompanyResponse = {
  company?: HirebaseCompany;
  jobs?: HirebaseJob[];
};

type PaginatedJobs = {
  jobs: HirebaseJob[];
  total_count?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
};

type CompanySearchResponse = {
  companies?: HirebaseCompany[];
  total_count?: number;
};

export function isHirebaseConfigured(): boolean {
  return !!process.env.HIREBASE_API_KEY?.trim();
}

function getApiKey(): string {
  const key = process.env.HIREBASE_API_KEY?.trim();
  if (!key) throw new Error("HIREBASE_API_KEY is not configured.");
  return key;
}

async function hirebaseFetch<T>(
  path: string,
  init?: RequestInit,
  ctx?: { userId?: string | null },
): Promise<T> {
  const method = init?.method ?? "GET";
  const res = await fetch(`${HIREBASE_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(30000),
  });

  if (res.status === 404) {
    logHirebaseApiCall({ path, method, userId: ctx?.userId, status: 404 });
    throw new HirebaseNotFoundError(path);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(formatHirebaseErrorBody(body, res.status));
  }

  const data = (await res.json()) as T;
  logHirebaseApiCall({ path, method, userId: ctx?.userId, data, status: res.status });
  return data;
}

export class HirebaseNotFoundError extends Error {
  constructor(path: string) {
    super(`Hirebase resource not found: ${path}`);
    this.name = "HirebaseNotFoundError";
  }
}

function formatLocation(job: HirebaseJob): string | null {
  const loc = job.locations?.[0];
  if (loc) {
    const parts = [loc.city, loc.region, loc.country].filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  if (job.location_type) return job.location_type;
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

function formatSalaryRange(range: HirebaseJob["salary_range"]): string | null {
  if (!range?.min && !range?.max) return null;
  const currency = range.currency ?? "USD";
  const fmt = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}K` : `${currency} ${n.toLocaleString()}`;
  if (range.min && range.max) return `${fmt(range.min)}–${fmt(range.max)}`;
  if (range.min) return `${fmt(range.min)}+`;
  if (range.max) return `Up to ${fmt(range.max)}`;
  return null;
}

function formatYoeRange(range: HirebaseJob["yoe_range"]): string | null {
  if (!range?.min && !range?.max) return null;
  if (range.min != null && range.max != null) return `${range.min}–${range.max} years`;
  if (range.min != null) return `${range.min}+ years`;
  if (range.max != null) return `Up to ${range.max} years`;
  return null;
}

function remoteFromLocationType(locationType: string | undefined): boolean | null {
  if (!locationType) return null;
  const lower = locationType.toLowerCase();
  if (lower.includes("remote")) return true;
  if (lower.includes("in-person") || lower.includes("on-site") || lower.includes("onsite")) return false;
  return null;
}

function mergeSkillLists(job: HirebaseJob): string[] {
  const merged = [...(job.skills ?? []), ...(job.technologies ?? [])]
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(merged)].slice(0, 32);
}

function requirementsFromSummary(summary: string | null | undefined): string[] | undefined {
  if (!summary?.trim()) return undefined;
  return [summary.trim()];
}

function hasFullJobDescription(description: string | null | undefined): boolean {
  return (description?.trim().length ?? 0) >= 200;
}

export function mapHirebaseJob(job: HirebaseJob): CachedJob {
  const descriptionSource = job.description_raw ?? job.description;
  const description = descriptionSource ? stripHtml(descriptionSource).slice(0, 16000) : null;
  const skills = mergeSkillLists(job);
  const requirementsSummary = job.requirements_summary?.trim() || null;
  const fullDescription = hasFullJobDescription(description);
  const parsed = fullDescription ? parseJobDescriptionSections(description) : null;
  const parsedSections = parsed && hasParsedJobSections(parsed) ? parsed : null;

  return {
    title: (job.job_title ?? job.title ?? "Untitled role").trim(),
    location: formatLocation(job),
    department: job.job_categories?.[0] ?? job.team ?? job.job_board ?? null,
    url: job.application_link ?? null,
    hirebaseId: job._id ?? null,
    jobSlug: job.job_slug ?? null,
    companySlug: job.company_slug ?? null,
    companyLink: job.company_link ?? null,
    companyLogo: job.company_logo ?? null,
    description,
    jobSummary: parsedSections?.summary?.trim()
      || (fullDescription ? summaryParagraphFromText(description!) : requirementsSummary ?? (description ? description.slice(0, 420) : null)),
    companySummary: job.company_data?.description_summary?.trim() || null,
    industries: job.company_data?.industries?.length ? job.company_data.industries : undefined,
    subindustries: job.company_data?.subindustries?.length ? job.company_data.subindustries : undefined,
    jobType: job.job_type ?? null,
    remote: remoteFromLocationType(job.location_type),
    seniority: job.experience_level ?? null,
    experienceLevel: formatYoeRange(job.yoe_range),
    salary: formatSalaryRange(job.salary_range),
    skills: skills.length ? skills : undefined,
    technologies: job.technologies?.length ? job.technologies : undefined,
    benefits: parsedSections?.benefits.length
      ? parsedSections.benefits
      : job.benefits?.length
        ? job.benefits
        : undefined,
    responsibilities: parsedSections?.responsibilities.length ? parsedSections.responsibilities : undefined,
    requiredQualifications: parsedSections?.requiredQualifications.length
      ? parsedSections.requiredQualifications
      : fullDescription
        ? undefined
        : requirementsFromSummary(requirementsSummary),
    preferredQualifications: parsedSections?.preferredQualifications.length
      ? parsedSections.preferredQualifications
      : undefined,
    tags: job.job_categories?.length ? job.job_categories : undefined,
    datePosted: job.date_posted ?? null,
    team: job.team ?? null,
    educationLevel: job.education_level ?? null,
    visaSponsored: job.visa_sponsored ?? null,
    jobBoard: job.job_board ?? null,
  };
}

function summaryParagraphFromText(text: string): string {
  const first = text.split(/\n\n+/)[0]?.trim() ?? text.trim();
  if (first.length <= 420) return first;
  return first.slice(0, 420).trim() + "…";
}

export async function resolveHirebaseCompanySlug(
  companyName: string,
  slugHint?: string | null
): Promise<string | null> {
  const candidates = [slugHint?.trim(), companyName.trim()].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      await hirebaseFetch<PaginatedJobs>(
        `/v2/hirebase/companies/${encodeURIComponent(candidate)}/jobs?page=1&limit=1`
      );
      return candidate;
    } catch (err) {
      if (!(err instanceof HirebaseNotFoundError)) throw err;
    }
  }

  const search = await hirebaseFetch<CompanySearchResponse>("/v2/hirebase/companies/search", {
    method: "POST",
    body: JSON.stringify({
      company_name: companyName.trim(),
      limit: 5,
      page: 1,
    }),
  });

  const companies = search.companies ?? [];
  if (!companies.length) return null;

  const normalized = companyName.trim().toLowerCase();
  const exact =
    companies.find((c) => c.company_name?.trim().toLowerCase() === normalized) ??
    companies.find((c) => c.company_slug?.trim().toLowerCase() === slugHint?.trim().toLowerCase());

  return exact?.company_slug ?? exact?.slug ?? companies[0].company_slug ?? companies[0].slug ?? null;
}

/** Typeahead search for company watchlist (onboarding + Companies). */
export async function searchHirebaseCompanies(query: string, limit = 8): Promise<HirebaseCompany[]> {
  if (!isHirebaseConfigured()) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const search = await hirebaseFetch<CompanySearchResponse>("/v2/hirebase/companies/search", {
    method: "POST",
    body: JSON.stringify({
      company_name: q,
      limit: Math.min(limit, 12),
      page: 1,
    }),
  });

  return (search.companies ?? []).slice(0, limit);
}

function normalizeCompanyProfile(
  raw: HirebaseCompany,
  sampleOpenJobs = 0,
  sampleJobs: HirebaseJob[] = [],
): HirebaseCompanyProfile {
  const slug = raw.company_slug ?? raw.slug ?? "";
  return {
    company_slug: slug,
    company_name: raw.company_name ?? slug,
    company_logo: raw.company_logo ?? null,
    company_link: raw.company_link ?? null,
    linkedin_link: raw.linkedin_link ?? null,
    description_summary: raw.description_summary ?? null,
    job_board: raw.job_board ?? null,
    size_range: raw.size_range ?? null,
    industries: raw.industries ?? [],
    subindustries: raw.subindustries ?? [],
    services: raw.services ?? [],
    company_type: raw.type ?? null,
    is_recruiting_agency: raw.is_recruiting_agency ?? null,
    is_third_party_agency: raw.is_3rd_party_agency ?? null,
    sample_open_jobs: raw.total_jobs ?? sampleOpenJobs,
    sample_roles: sampleJobs.slice(0, 10).map((job) => ({
      title: job.job_title?.trim() || job.title?.trim() || "Open role",
      location: formatLocation(job),
      url: job.application_link?.trim() || job.job_board_link?.trim() || null,
    })),
  };
}

export async function fetchHirebaseCompanyProfile(input: {
  companyName: string;
  slugHint?: string | null;
  website?: string | null;
}): Promise<HirebaseCompanyProfile> {
  let slug = await resolveHirebaseCompanySlug(input.companyName, input.slugHint);

  if (!slug) {
    const search = await hirebaseFetch<CompanySearchResponse>("/v2/hirebase/companies/search", {
      method: "POST",
      body: JSON.stringify({
        company_name: input.companyName.trim(),
        limit: 5,
        page: 1,
      }),
    });
    const match =
      search.companies?.find(
        (c) => c.company_name?.trim().toLowerCase() === input.companyName.trim().toLowerCase()
      ) ?? search.companies?.[0];
    if (!match) throw new Error(`No Hirebase profile for "${input.companyName}".`);
    return normalizeCompanyProfile(match, match.total_jobs ?? 0);
  }

  try {
    const data = await hirebaseFetch<GetCompanyResponse>(
      `/v2/hirebase/companies/${encodeURIComponent(slug)}`
    );
    if (data.company) {
      return normalizeCompanyProfile(
        data.company,
        data.company.total_jobs ?? data.jobs?.length ?? 0,
        data.jobs ?? [],
      );
    }
  } catch (err) {
    if (!(err instanceof HirebaseNotFoundError)) throw err;
  }

  const search = await hirebaseFetch<CompanySearchResponse>("/v2/hirebase/companies/search", {
    method: "POST",
    body: JSON.stringify({
      company_name: input.companyName.trim(),
      limit: 5,
      page: 1,
    }),
  });
  const match =
    search.companies?.find(
      (c) => c.company_name?.trim().toLowerCase() === input.companyName.trim().toLowerCase()
    ) ?? search.companies?.[0];
  if (!match) throw new Error(`No Hirebase profile for "${input.companyName}".`);
  return normalizeCompanyProfile(match, match.total_jobs ?? 0);
}

export async function fetchHirebaseCompanyJobs(input: {
  companyName: string;
  slugHint?: string | null;
  website?: string | null;
  maxJobs?: number;
  pageSize?: number;
}): Promise<{
  jobs: CachedJob[];
  hirebaseSlug: string | null;
  totalCount: number;
  scannedUrl: string;
}> {
  const maxJobs = Math.max(1, Math.min(input.maxJobs ?? 500, 5000));
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 100, 1000));

  let slug = await resolveHirebaseCompanySlug(input.companyName, input.slugHint);

  if (!slug) {
    const domain = hostnameFromUrl(input.website);
    if (domain) {
      slug = await resolveHirebaseCompanySlug(domain.replace(/^www\./, ""), input.slugHint);
    }
  }

  const collected: HirebaseJob[] = [];
  let totalCount = 0;
  let scannedUrl = input.website?.trim() || `hirebase:company:${input.companyName}`;

  if (slug) {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && collected.length < maxJobs) {
      const data = await hirebaseFetch<PaginatedJobs>(
        `/v2/hirebase/companies/${encodeURIComponent(slug)}/jobs?page=${page}&limit=${pageSize}&sort_by=date_posted&sort_order=desc`
      );
      totalCount = data.total_count ?? collected.length + (data.jobs?.length ?? 0);
      totalPages = data.total_pages ?? 1;
      collected.push(...(data.jobs ?? []));
      page += 1;
    }

    scannedUrl = `https://api.hirebase.org/v2/hirebase/companies/${slug}/jobs`;
  } else {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && collected.length < maxJobs) {
      const data = await hirebaseFetch<PaginatedJobs>("/v2/jobs/search", {
        method: "POST",
        body: JSON.stringify({
          company_name: input.companyName.trim(),
          page,
          limit: pageSize,
          sort_by: "date_posted",
          sort_order: "desc",
        }),
      });
      totalCount = data.total_count ?? collected.length + (data.jobs?.length ?? 0);
      totalPages = data.total_pages ?? 1;
      collected.push(...(data.jobs ?? []));
      slug = collected[0]?.company_slug ?? slug;
      page += 1;
    }

    scannedUrl = `https://api.hirebase.org/v2/jobs/search?company_name=${encodeURIComponent(input.companyName.trim())}`;
  }

  const jobs = collected.slice(0, maxJobs).map(mapHirebaseJob);
  if (collected[0]?.company_link) {
    scannedUrl = collected[0].company_link;
  }

  return {
    jobs,
    hirebaseSlug: slug,
    totalCount: totalCount || jobs.length,
    scannedUrl,
  };
}

/** Targeted search: company + role titles — bills only for jobs returned (match-only scans). */
/** Apply Hirebase search filters except company scope (set per company call). */
function assignJobSearchFiltersExceptCompany(body: Record<string, unknown>, input: VectorSearchFilters) {
  const { companyName: _cn, companySlug: _cs, ...rest } = input;
  assignJobSearchFilters(body, rest);
}

export async function fetchHirebaseMatchingJobs(input: {
  companyName: string;
  slugHint?: string | null;
  hirebaseSlug?: string | null;
  website?: string | null;
  jobTitles: string[];
  extraKeywords?: string[];
  maxJobs?: number;
  filters?: VectorSearchFilters;
}): Promise<{
  jobs: CachedJob[];
  hirebaseSlug: string | null;
  totalCount: number;
  scannedUrl: string;
}> {
  const titles = input.jobTitles.map((t) => t.trim()).filter(Boolean);
  if (!titles.length) {
    return { jobs: [], hirebaseSlug: null, totalCount: 0, scannedUrl: "" };
  }

  const maxJobs = Math.max(1, Math.min(input.maxJobs ?? 50, 100));
  let slug = input.hirebaseSlug?.trim() || (await resolveHirebaseCompanySlug(input.companyName, input.slugHint));
  const keywords = roleSearchKeywords(titles);
  if (input.extraKeywords?.length) {
    for (const kw of input.extraKeywords) {
      const w = kw.trim().toLowerCase();
      if (w.length >= 3 && !keywords.includes(w)) keywords.push(w);
    }
  }

  const baseSort = {
    page: 1,
    limit: maxJobs,
    sort_by: "date_posted",
    sort_order: "desc",
  };

  const attempts: Record<string, unknown>[] = [];
  if (slug) {
    attempts.push({ company_slug: slug, keywords, job_titles: titles, ...baseSort });
    attempts.push({ company_slug: slug, keywords, ...baseSort });
  }
  attempts.push({ company_name: input.companyName.trim(), keywords, job_titles: titles, ...baseSort });
  attempts.push({ company_name: input.companyName.trim(), keywords, ...baseSort });

  let collected: HirebaseJob[] = [];
  let totalCount = 0;

  for (const body of attempts) {
    if (collected.length >= maxJobs) break;
    if (input.filters) assignJobSearchFiltersExceptCompany(body, input.filters);
    try {
      const data = await hirebaseFetch<PaginatedJobs>("/v2/jobs/search", {
        method: "POST",
        body: JSON.stringify(body),
      });
      totalCount = data.total_count ?? collected.length + (data.jobs?.length ?? 0);
      collected.push(...(data.jobs ?? []));
      slug = slug ?? collected[0]?.company_slug ?? null;
      if (collected.length) break;
    } catch {
      continue;
    }
  }

  const jobs = dedupeHirebaseJobs(collected).slice(0, maxJobs).map(mapHirebaseJob);
  const scannedUrl = slug
    ? `https://api.hirebase.org/v2/jobs/search?company_slug=${encodeURIComponent(slug)}`
    : `https://api.hirebase.org/v2/jobs/search?company_name=${encodeURIComponent(input.companyName.trim())}`;

  return {
    jobs,
    hirebaseSlug: slug,
    totalCount: totalCount || jobs.length,
    scannedUrl,
  };
}

function assignJobSearchFilters(body: Record<string, unknown>, input: VectorSearchFilters) {
  assignIfPresent(body, "company_name", input.companyName?.trim());
  assignIfPresent(body, "company_slug", input.companySlug?.trim());
  assignIfPresent(body, "job_board", input.jobBoard?.trim());
  assignIfPresent(body, "industries", input.industries?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "subindustries", input.subindustries?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "job_categories", input.jobCategories?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "job_types", input.jobTypes?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "experience", input.experienceLevels?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "company_types", input.companySizeBuckets?.map((t) => t.trim()).filter(Boolean));
  if (input.locations?.length) {
    body.locations = input.locations
      .map((loc) => ({
        city: loc.city?.trim() || undefined,
        region: loc.region?.trim() || undefined,
        country: loc.country?.trim() || undefined,
      }))
      .filter((loc) => loc.city || loc.region || loc.country);
  }
  assignIfPresent(body, "date_posted", input.datePostedFrom?.trim());
  if (input.visaSponsored === true) body.visa_sponsored = true;
  if (input.salaryFrom != null) body.salary_from = input.salaryFrom;
  if (input.salaryTo != null) body.salary_to = input.salaryTo;
  if (input.yearsFrom != null) body.years_from = input.yearsFrom;
  if (input.yearsTo != null) body.years_to = input.yearsTo;
}

/** Global role-based job search — same Hirebase `/v2/jobs/search` path as Companies matching. */
export async function fetchHirebaseRoleMatchingJobs(input: {
  matchRoles: string[];
  semanticQuery?: string;
  filters: VectorSearchFilters;
}): Promise<{
  jobs: CachedJob[];
  rawJobs: HirebaseJob[];
  companyNames: string[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const titles = input.matchRoles.map((t) => t.trim()).filter(Boolean);
  if (!titles.length) {
    return { jobs: [], rawJobs: [], companyNames: [], totalCount: 0, page: 1, limit: 0, totalPages: 0 };
  }

  const keywords = roleSearchKeywords(titles);
  if (input.semanticQuery?.trim()) {
    for (const word of input.semanticQuery.toLowerCase().split(/\s+/)) {
      const w = word.replace(/[^a-z0-9+#]/g, "");
      if (w.length >= 3 && !keywords.includes(w)) keywords.push(w);
    }
  }
  if (input.filters.keywords?.length) {
    for (const kw of input.filters.keywords) {
      const w = kw.trim().toLowerCase();
      if (w.length >= 3 && !keywords.includes(w)) keywords.push(w);
    }
  }

  const limit = Math.max(1, Math.min(input.filters.limit ?? 20, 20));
  const page = Math.max(1, input.filters.page ?? 1);

  const body: Record<string, unknown> = {
    job_titles: titles.slice(0, 20),
    keywords: keywords.slice(0, 12),
    page,
    limit,
    sort_by: "date_posted",
    sort_order: "desc",
  };

  assignJobSearchFilters(body, input.filters);

  const data = await hirebaseFetch<PaginatedJobs>("/v2/jobs/search", {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  const rawJobs = dedupeHirebaseJobs(data.jobs ?? [])
    .filter((job) => {
      const title = job.job_title ?? job.title ?? "";
      const department = job.job_categories?.[0] ?? job.team ?? null;
      return isJobMatch(title, titles, department);
    })
    .slice(0, limit);

  const jobs = rawJobs.map(mapHirebaseJob);
  const companyNames = rawJobs.map((j) => j.company_name?.trim() || "Unknown company");

  return {
    jobs,
    rawJobs,
    companyNames,
    totalCount: data.total_count ?? jobs.length,
    page: data.page ?? page,
    limit: data.limit ?? limit,
    totalPages: data.total_pages ?? 1,
  };
}

/** Natural-language job search (summary mode) — no resume artifact. */
export async function fetchHirebaseSummarySearch(input: {
  query: string;
  filters: VectorSearchFilters;
}): Promise<{
  jobs: CachedJob[];
  rawJobs: HirebaseJob[];
  companyNames: string[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const query = trimVSearchQuery(input.query.trim());
  if (!query) {
    return { jobs: [], rawJobs: [], companyNames: [], totalCount: 0, page: 1, limit: 0, totalPages: 0 };
  }

  const requestedLimit = input.filters.limit ?? VECTOR_SEARCH_RESULTS_MAX;
  const limit = Math.max(1, Math.min(requestedLimit, requestedLimit > VECTOR_SEARCH_RESULTS_MAX ? 100 : VECTOR_SEARCH_RESULTS_MAX));
  const page = Math.max(1, input.filters.page ?? 1);

  const body: Record<string, unknown> = {
    search_type: "summary",
    query,
    limit,
    page,
    accuracy: input.filters.accuracy ?? 0.35,
    top_k: input.filters.topK ?? limit,
  };

  if (input.filters.offset != null) body.offset = input.filters.offset;
  if (input.filters.minScore != null) body.score = input.filters.minScore;
  if (input.filters.jobTitles?.length) {
    assignIfPresent(body, "job_title", input.filters.jobTitles[0]?.trim());
  }
  assignJobSearchFilters(body, input.filters);

  const data = await hirebaseFetch<PaginatedJobs>("/v2/jobs/vsearch", {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  const rawJobs = dedupeHirebaseJobs(data.jobs ?? []).slice(0, limit);
  const jobs = rawJobs.map(mapHirebaseJob);
  const companyNames = rawJobs.map((j) => j.company_name?.trim() || "Unknown company");

  return {
    jobs,
    rawJobs,
    companyNames,
    totalCount: data.total_count ?? jobs.length,
    page: data.page ?? page,
    limit: data.limit ?? limit,
    totalPages: data.total_pages ?? 1,
  };
}

function dedupeHirebaseJobs(jobs: HirebaseJob[]): HirebaseJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = (job._id ?? job.application_link ?? job.job_title ?? job.title ?? "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type HirebaseVSearchInput = VectorSearchFilters & {
  /** Hirebase resume embed artifact from onboarding / resume upload. */
  artifactId: string;
  /** Optional natural-language focus — omit for pure resume matching. */
  query?: string;
  /** Hirebase allows up to 100/page; we fetch extra when post-filtering to tracked companies. */
  fetchLimit?: number;
};

type HirebaseVSearchResponse = PaginatedJobs;

function assignIfPresent(body: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (typeof value === "string" && !value.trim()) return;
  if (Array.isArray(value) && value.length === 0) return;
  body[key] = value;
}

/** Resume-based job search via `POST /v2/jobs/vsearch` (`search_type=resume`, `artifact_id` required). */
export async function fetchHirebaseVectorJobs(
  input: HirebaseVSearchInput
): Promise<{
  jobs: CachedJob[];
  rawJobs: HirebaseJob[];
  companyNames: string[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const artifactId = input.artifactId.trim();
  if (!artifactId) {
    return { jobs: [], rawJobs: [], companyNames: [], totalCount: 0, page: 1, limit: 0, totalPages: 0 };
  }

  const optionalQuery = input.query?.trim() ? trimVSearchQuery(input.query.trim()) : undefined;

  const page = Math.max(1, input.page ?? 1);
  const requestedLimit = input.limit ?? VECTOR_SEARCH_RESULTS_MAX;
  const responseCap = requestedLimit > VECTOR_SEARCH_RESULTS_MAX ? 100 : VECTOR_SEARCH_RESULTS_MAX;
  const responseLimit = Math.max(1, Math.min(requestedLimit, responseCap));
  const fetchLimit = Math.max(
    responseLimit,
    Math.min(input.fetchLimit ?? responseLimit, 100),
  );

  const body: Record<string, unknown> = {
    search_type: "resume",
    artifact_id: artifactId,
    limit: fetchLimit,
    page,
    accuracy: input.accuracy ?? 0.35,
    top_k: input.topK ?? fetchLimit,
  };

  if (optionalQuery) body.query = optionalQuery;

  if (input.offset != null) body.offset = input.offset;
  if (input.minScore != null) body.score = input.minScore;
  assignIfPresent(body, "company_name", input.companyName?.trim());
  assignIfPresent(body, "company_slug", input.companySlug?.trim());
  assignIfPresent(body, "job_slug", input.jobSlug?.trim());
  assignIfPresent(body, "job_board", input.jobBoard?.trim());
  if (input.jobTitles?.length) {
    assignIfPresent(body, "job_title", input.jobTitles[0]?.trim());
  }
  assignIfPresent(body, "industries", input.industries?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "subindustries", input.subindustries?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "job_categories", input.jobCategories?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "job_types", input.jobTypes?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "experience", input.experienceLevels?.map((t) => t.trim()).filter(Boolean));
  assignIfPresent(body, "company_types", input.companySizeBuckets?.map((t) => t.trim()).filter(Boolean));
  if (input.locations?.length) {
    body.locations = input.locations
      .map((loc) => ({
        city: loc.city?.trim() || undefined,
        region: loc.region?.trim() || undefined,
        country: loc.country?.trim() || undefined,
      }))
      .filter((loc) => loc.city || loc.region || loc.country);
  }
  assignIfPresent(body, "date_posted", input.datePostedFrom?.trim());
  if (input.visaSponsored === true) body.visa_sponsored = true;
  if (input.salaryFrom != null) body.salary_from = input.salaryFrom;
  if (input.salaryTo != null) body.salary_to = input.salaryTo;
  if (input.yearsFrom != null) body.years_from = input.yearsFrom;
  if (input.yearsTo != null) body.years_to = input.yearsTo;

  const data = await hirebaseFetch<HirebaseVSearchResponse>("/v2/jobs/vsearch", {
    method: "POST",
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  const rawJobs = dedupeHirebaseJobs(data.jobs ?? []).slice(0, responseLimit);
  const jobs = rawJobs.map(mapHirebaseJob);
  const companyNames = rawJobs.map((j) => j.company_name?.trim() || "Unknown company");

  return {
    jobs,
    rawJobs,
    companyNames,
    totalCount: data.total_count ?? jobs.length,
    page: data.page ?? page,
    limit: responseLimit,
    totalPages: data.total_pages ?? 1,
  };
}

/** Full job record — used when opening a recommended or watchlist posting. */
export async function fetchHirebaseJobById(
  jobId: string,
): Promise<{ job: CachedJob; companyName: string; raw: HirebaseJob } | null> {
  if (!jobId.trim()) return null;
  try {
    const raw = await hirebaseFetch<HirebaseJob>(
      `/v2/jobs/${encodeURIComponent(jobId.trim())}?return_raw_description=true`,
    );
    return {
      job: mapHirebaseJob(raw),
      companyName: raw.company_name?.trim() || "Unknown company",
      raw,
    };
  } catch (err) {
    if (err instanceof HirebaseNotFoundError) return null;
    throw err;
  }
}
