/** Job Intelligence by DataNest — RapidAPI client. */

const DATANEST_HOST = "job-intelligence-by-datanest.p.rapidapi.com";
const DATANEST_BASE = `https://${DATANEST_HOST}`;

export type DataNestTrendingJobRow = {
  job_id: string;
  title: string;
  company: string;
  location: string;
  posted_ago: string;
};

export type DataNestTrendingCategoryRow = {
  category: string;
  live_listing_count_sample?: number;
  top_jobs?: DataNestTrendingJobRow[];
  error?: string;
};

export type DataNestTrendingResponse = {
  status: string;
  data: DataNestTrendingCategoryRow[];
  timestamp?: number;
};

export type DataNestCompareResponse = Record<string, unknown>;

export class DataNestApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DataNestApiError";
    this.status = status;
  }
}

export function isDatanestConfigured(): boolean {
  return Boolean(getDatanestApiKey());
}

function getDatanestApiKey(): string | null {
  const key = process.env.DATANEST_RAPIDAPI_KEY?.trim() || process.env.RAPIDAPI_KEY?.trim();
  return key || null;
}

async function datanestFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = getDatanestApiKey();
  if (!apiKey) {
    throw new DataNestApiError("DataNest is not configured (set DATANEST_RAPIDAPI_KEY or RAPIDAPI_KEY).", 503);
  }

  const url = path.startsWith("http") ? path : `${DATANEST_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-rapidapi-host": DATANEST_HOST,
      "x-rapidapi-key": apiKey,
      ...init?.headers,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { raw: text };
    }
  }

  if (!res.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: string }).message)
        : typeof body === "object" && body && "detail" in body
          ? String((body as { detail?: string }).detail)
          : `DataNest request failed (${res.status})`;
    throw new DataNestApiError(message, res.status);
  }

  return body as T;
}

/** Live trending roles, categories, and sample job listings. */
export async function fetchDatanestTrending(category?: string): Promise<DataNestTrendingResponse> {
  const params = category?.trim() ? `?category=${encodeURIComponent(category.trim())}` : "";
  return datanestFetch<DataNestTrendingResponse>(`/trending${params}`);
}

/** Documented endpoints — may 404 until DataNest ships them on RapidAPI. */
export async function fetchDatanestOverview(): Promise<Record<string, unknown>> {
  return datanestFetch<Record<string, unknown>>("/overview");
}

export async function fetchDatanestSkills(role?: string): Promise<Record<string, unknown>> {
  const params = role?.trim() ? `?role=${encodeURIComponent(role.trim())}` : "";
  return datanestFetch<Record<string, unknown>>(`/skills${params}`);
}

export async function fetchDatanestSalary(role?: string): Promise<Record<string, unknown>> {
  const params = role?.trim() ? `?role=${encodeURIComponent(role.trim())}` : "";
  return datanestFetch<Record<string, unknown>>(`/salary${params}`);
}

export async function fetchDatanestCompanies(role?: string): Promise<Record<string, unknown>> {
  const params = role?.trim() ? `?role=${encodeURIComponent(role.trim())}` : "";
  return datanestFetch<Record<string, unknown>>(`/companies${params}`);
}

export async function fetchDatanestCompare(roles: string[]): Promise<DataNestCompareResponse> {
  const query = roles.map((r) => `role=${encodeURIComponent(r.trim())}`).join("&");
  return datanestFetch<DataNestCompareResponse>(`/compare${query ? `?${query}` : ""}`);
}
