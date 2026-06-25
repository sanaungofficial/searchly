import {
  fieldKeys,
  mergeNetworkJobExport,
  NETWORK_JOB_SUBRESOURCE_PATHS,
  recruiterIdFromJob,
} from "@/lib/topechelon/job-export";
import {
  parseTopEchelonAuthError,
  TopEchelonAuthError,
  TopEchelonMfaRequiredError,
  TopEchelonSessionExpiredError,
} from "@/lib/topechelon/errors";
import type {
  TopEchelonCookie,
  TopEchelonJobFullExport,
  TopEchelonLoginOptions,
  TopEchelonNetworkJobRaw,
  TopEchelonSessionData,
  TopEchelonTokenPayload,
} from "@/lib/topechelon/types";

const DEFAULT_API_BASE = "https://bb3api.topechelon.com";
const WEB_ORIGIN = "https://bigbiller.topechelon.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function getApiBase(): string {
  return (process.env.TOPECHELON_API_BASE ?? DEFAULT_API_BASE).replace(/\/$/, "");
}

function parseSetCookie(setCookie: string | null): TopEchelonCookie[] {
  if (!setCookie) return [];
  const out: TopEchelonCookie[] = [];
  for (const part of setCookie.split(/,(?=\s*[^;,]+=[^;,]+)/)) {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name) out.push({ name, value });
  }
  return out;
}

function mergeCookies(existing: TopEchelonCookie[], incoming: TopEchelonCookie[]): TopEchelonCookie[] {
  const map = new Map(existing.map((c) => [c.name, c.value]));
  for (const c of incoming) map.set(c.name, c.value);
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

function cookieHeader(cookies: TopEchelonCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function csrfToken(cookies: TopEchelonCookie[]): string | undefined {
  return cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
}

export class TopEchelonClient {
  private cookies: TopEchelonCookie[];
  private tokenPayload: TopEchelonTokenPayload | null;

  constructor(session?: TopEchelonSessionData | null) {
    this.cookies = session?.cookies ?? [];
    this.tokenPayload = session?.tokenPayload ?? null;
  }

  getSession(): TopEchelonSessionData {
    return {
      cookies: this.cookies,
      tokenPayload: this.tokenPayload,
    };
  }

  async warmSession(): Promise<void> {
    await this.request("GET", "/status.json");
  }

  async login(options: TopEchelonLoginOptions): Promise<TopEchelonSessionData> {
    await this.warmSession();

    const body: Record<string, unknown> = {
      grant_type: "password",
      email: options.email,
      password: options.password,
      remember_me: options.rememberMe ?? true,
    };
    if (options.mfaCode) body.mfa_code = options.mfaCode;
    if (options.newDeviceMfaCode) body.new_device_mfa_code = options.newDeviceMfaCode;

    try {
      const payload = await this.request<TopEchelonTokenPayload>("POST", "/auth/token", body);
      if (payload && Object.keys(payload).length > 0) {
        this.tokenPayload = payload;
      }
    } catch (err) {
      if (err instanceof TopEchelonMfaRequiredError && !options.mfaCode && !options.newDeviceMfaCode) {
        throw err;
      }
      throw err;
    }

    if (!this.tokenPayload?.userId && !this.tokenPayload?.user_id) {
      throw new TopEchelonAuthError("Login succeeded but no token payload was returned.");
    }

    return this.getSession();
  }

  async refreshSession(): Promise<TopEchelonSessionData> {
    if (!this.cookies.length) {
      throw new TopEchelonSessionExpiredError();
    }

    try {
      const payload = await this.request<TopEchelonTokenPayload>("POST", "/auth/token", {
        grant_type: "refresh_token",
      });
      if (payload && Object.keys(payload).length > 0) {
        this.tokenPayload = payload;
      }
      return this.getSession();
    } catch {
      throw new TopEchelonSessionExpiredError();
    }
  }

  async fetchNetworkJobsPage(
    searchId: string,
    options?: { page?: number; perPage?: number }
  ): Promise<{
    jobs: TopEchelonNetworkJobRaw[];
    pagination?: { total_pages?: number; total_count?: number; current_page?: number };
  }> {
    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 50;
    const res = await this.request<{
      entries?: TopEchelonNetworkJobRaw[];
      results?: TopEchelonNetworkJobRaw[];
      pagination?: { total_pages?: number; total_count?: number; current_page?: number };
    }>("GET", `/job_searches/${searchId}/network_jobs.json`, undefined, {
      page: String(page),
      per_page: String(perPage),
      sort_by: "date_shared",
      sort_order: "desc",
    });

    return {
      jobs: res.entries ?? res.results ?? [],
      pagination: res.pagination,
    };
  }

  async fetchNetworkJobsFromSearch(
    searchId: string,
    options?: { perPage?: number; maxPages?: number; limit?: number; fullCatalog?: boolean }
  ): Promise<TopEchelonNetworkJobRaw[]> {
    const perPage = options?.perPage ?? 50;
    const defaultMaxPages = options?.fullCatalog ? 120 : 40;
    const maxPages = options?.maxPages ?? defaultMaxPages;
    const limit = options?.limit;
    const jobs: TopEchelonNetworkJobRaw[] = [];
    let totalPages = maxPages;

    for (let page = 1; page <= totalPages; page++) {
      const res = await this.fetchNetworkJobsPage(searchId, { page, perPage });
      if (page === 1 && res.pagination?.total_pages) {
        totalPages = Math.min(res.pagination.total_pages, maxPages);
      }

      const batch = res.jobs;
      if (!batch.length) break;
      jobs.push(...batch);
      if (limit && jobs.length >= limit) return jobs.slice(0, limit);
      if (batch.length < perPage) break;
    }

    return limit ? jobs.slice(0, limit) : jobs;
  }

  async fetchAllNetworkJobs(options?: {
    perPage?: number;
    maxPages?: number;
    limit?: number;
    searchId?: string;
    fullCatalog?: boolean;
    allStatuses?: boolean;
  }): Promise<TopEchelonNetworkJobRaw[]> {
    const searchId =
      options?.searchId ??
      (await this.createNetworkJobSearch({ allStatuses: options?.allStatuses ?? options?.fullCatalog }));
    return this.fetchNetworkJobsFromSearch(String(searchId), options);
  }

  /** Full job record including description, benefits, requirements, etc. */
  async fetchNetworkJobDetail(jobId: string): Promise<TopEchelonNetworkJobRaw> {
    const res = await this.request<{ network_job?: TopEchelonNetworkJobRaw } & TopEchelonNetworkJobRaw>(
      "GET",
      `/network/jobs/${jobId}.json`
    );
    return (res.network_job ?? res) as TopEchelonNetworkJobRaw;
  }

  async fetchOptionalJson<T>(path: string, query?: Record<string, string>): Promise<T | null> {
    return this.request<T>("GET", path, undefined, query, { notFoundOk: true });
  }

  private async fetchFirstOptionalJson<T>(paths: string[]): Promise<T | null> {
    for (const path of paths) {
      const payload = await this.fetchOptionalJson<T>(path);
      if (payload && typeof payload === "object" && Object.keys(payload as object).length > 0) {
        return payload;
      }
    }
    return null;
  }

  /** List row + detail + best-effort sub-resources (agency, submissions, shares, recruiter). */
  async fetchNetworkJobFullExport(listSummary: TopEchelonNetworkJobRaw): Promise<TopEchelonJobFullExport> {
    const jobId = String(listSummary.id);
    let detail: TopEchelonNetworkJobRaw;
    try {
      detail = await this.fetchNetworkJobDetail(jobId);
    } catch {
      detail = listSummary;
    }

    const [agencyDetails, submissionSummary, shares] = await Promise.all([
      this.fetchFirstOptionalJson<unknown>(NETWORK_JOB_SUBRESOURCE_PATHS.agencyDetails(jobId)),
      this.fetchFirstOptionalJson<unknown>(NETWORK_JOB_SUBRESOURCE_PATHS.submissionSummary(jobId)),
      this.fetchFirstOptionalJson<unknown>(NETWORK_JOB_SUBRESOURCE_PATHS.shares(jobId)),
    ]);

    const recruiterId = recruiterIdFromJob(detail) ?? recruiterIdFromJob(listSummary);
    const recruiterDetails = recruiterId
      ? await this.fetchFirstOptionalJson<unknown>(NETWORK_JOB_SUBRESOURCE_PATHS.recruiterDetails(recruiterId))
      : null;

    const exportBundle: TopEchelonJobFullExport = {
      listSummary,
      detail,
      agencyDetails,
      submissionSummary,
      shares,
      recruiterDetails,
      fieldKeys: {
        listSummary: fieldKeys(listSummary) ?? [],
        detail: fieldKeys(detail) ?? [],
        agencyDetails: fieldKeys(agencyDetails),
        submissionSummary: fieldKeys(submissionSummary),
        shares: fieldKeys(shares),
        recruiterDetails: fieldKeys(recruiterDetails),
      },
    };

    return exportBundle;
  }

  /** Merged TE payload ready for DB upsert (detail + sub-resources + stable list id). */
  async fetchNetworkJobMerged(listSummary: TopEchelonNetworkJobRaw): Promise<TopEchelonNetworkJobRaw> {
    const exportBundle = await this.fetchNetworkJobFullExport(listSummary);
    return mergeNetworkJobExport(listSummary, exportBundle);
  }

  /** List summaries then hydrate each with the full export (detail + sub-resources). */
  async fetchNetworkJobsWithDetails(limit: number): Promise<TopEchelonNetworkJobRaw[]> {
    const searchId = await this.createNetworkJobSearch();
    const { jobs } = await this.fetchNetworkJobsPage(String(searchId), {
      page: 1,
      perPage: Math.min(limit, 50),
    });
    return Promise.all(jobs.slice(0, limit).map((row) => this.fetchNetworkJobMerged(row)));
  }

  private async createNetworkJobSearch(options?: { allStatuses?: boolean }): Promise<number | string> {
    const attempts: Record<string, unknown>[] = options?.allStatuses
      ? [
          { job_search: { params: {} } },
          { params: {} },
          {},
          { job_search: { params: { network_status: "active" } } },
          { params: { network_status: "active" } },
          { network_status: "active" },
        ]
      : [
          { job_search: { params: { network_status: "active" } } },
          { params: { network_status: "active" } },
          { network_status: "active" },
        ];

    let lastError: unknown;
    for (const body of attempts) {
      try {
        const res = await this.request<{ id?: number | string; job_search?: { id?: number | string } }>(
          "POST",
          "/job_searches.json",
          body
        );
        const id = res.id ?? res.job_search?.id;
        if (id != null) return id;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError instanceof Error ? lastError : new TopEchelonAuthError("Unable to create Top Echelon job search.");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
    options?: { notFoundOk?: boolean }
  ): Promise<T> {
    const url = new URL(`${getApiBase()}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Origin: WEB_ORIGIN,
      Referer: `${WEB_ORIGIN}/`,
      "X-Requested-With": "XMLHttpRequest",
    };

    const token = csrfToken(this.cookies);
    if (token) headers["X-CSRF-Token"] = token;
    if (this.cookies.length) headers.Cookie = cookieHeader(this.cookies);

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const setCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie")].filter(Boolean);
    for (const raw of setCookies) {
      this.cookies = mergeCookies(this.cookies, parseSetCookie(raw));
    }

    const text = await res.text();
    if (!res.ok) {
      if (options?.notFoundOk && (res.status === 404 || res.status === 410)) {
        return null as T;
      }
      if (res.status === 401 && path.includes("/auth/token")) {
        throw parseTopEchelonAuthError(text);
      }
      if (res.status === 401) {
        throw new TopEchelonSessionExpiredError(text || "Unauthorized");
      }
      if (options?.notFoundOk && res.status >= 400 && res.status < 500) {
        return null as T;
      }
      throw new TopEchelonAuthError(text || `Top Echelon API ${res.status}`);
    }

    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return {} as T;
    }
  }
}

export function getTopEchelonCredentials(): TopEchelonLoginOptions | null {
  const email = process.env.TOPECHELON_EMAIL;
  const password = process.env.TOPECHELON_PASSWORD;
  if (!email || !password) return null;
  return { email, password, rememberMe: true };
}

export function getTopEchelonSearchId(): string | null {
  return process.env.TOPECHELON_SEARCH_ID?.trim() || null;
}
