import { hostnameFromUrl } from "@/lib/company-domain";

const HIREBASE_BASE = "https://api.hirebase.org";

export type HirebaseJob = {
  _id?: string;
  job_title?: string;
  title?: string;
  application_link?: string;
  job_categories?: string[];
  locations?: Array<{ city?: string; region?: string; country?: string }>;
  location_type?: string;
  company_name?: string;
  company_slug?: string;
  company_link?: string;
  job_board?: string;
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
  sample_open_jobs: number;
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

async function hirebaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
    throw new HirebaseNotFoundError(path);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body;
    try {
      detail = (JSON.parse(body) as { detail?: string }).detail ?? body;
    } catch {
      // keep raw body
    }
    throw new Error(detail || `Hirebase request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
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

export function mapHirebaseJob(job: HirebaseJob): {
  title: string;
  location: string | null;
  department: string | null;
  url: string | null;
} {
  return {
    title: (job.job_title ?? job.title ?? "Untitled role").trim(),
    location: formatLocation(job),
    department: job.job_categories?.[0] ?? job.job_board ?? null,
    url: job.application_link ?? null,
  };
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

function normalizeCompanyProfile(
  raw: HirebaseCompany,
  sampleOpenJobs = 0
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
    sample_open_jobs: raw.total_jobs ?? sampleOpenJobs,
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
      return normalizeCompanyProfile(data.company, data.jobs?.length ?? 0);
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
  jobs: Array<{
    title: string;
    location: string | null;
    department: string | null;
    url: string | null;
  }>;
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
