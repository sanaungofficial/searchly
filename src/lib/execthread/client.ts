import {
  ExecThreadAuthError,
  ExecThreadSessionExpiredError,
  parseExecThreadAuthError,
} from "@/lib/execthread/errors";
import type {
  ExecThreadCookie,
  ExecThreadJobExportBundle,
  ExecThreadListingRaw,
  ExecThreadLoginOptions,
  ExecThreadMemberJobResponse,
  ExecThreadRedeemOptions,
  ExecThreadRedeemResponse,
  ExecThreadSearchResponse,
  ExecThreadSessionData,
} from "@/lib/execthread/types";
import {
  execThreadJobNeedsRedeem,
  isSparseExecThreadListingDetail,
  mergeExecThreadJobExport,
} from "@/lib/execthread/job-export";

const DEFAULT_API_BASE = "https://api.execthread.com/api";
const WEB_ORIGIN = "https://execthread.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function getApiBase(): string {
  return (process.env.EXECTHREAD_API_BASE ?? DEFAULT_API_BASE).replace(/\/$/, "");
}

function parseSetCookie(setCookie: string | null): ExecThreadCookie[] {
  if (!setCookie) return [];
  const out: ExecThreadCookie[] = [];
  for (const part of setCookie.split(/,(?=\s*[A-Za-z_][\w-]*=)/)) {
    const segment = part.split(";")[0]?.trim();
    if (!segment) continue;
    const eq = segment.indexOf("=");
    if (eq <= 0) continue;
    out.push({ name: segment.slice(0, eq), value: segment.slice(eq + 1) });
  }
  return out;
}

function mergeCookies(existing: ExecThreadCookie[], incoming: ExecThreadCookie[]): ExecThreadCookie[] {
  const map = new Map(existing.map((c) => [c.name, c]));
  for (const c of incoming) map.set(c.name, c);
  return [...map.values()];
}

function cookieHeader(cookies: ExecThreadCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export class ExecThreadClient {
  private cookies: ExecThreadCookie[];

  constructor(session?: ExecThreadSessionData | null) {
    this.cookies = session?.cookies ?? [];
  }

  getSession(): ExecThreadSessionData {
    return { cookies: this.cookies };
  }

  configured(): boolean {
    return Boolean(process.env.EXECTHREAD_EMAIL?.trim() && process.env.EXECTHREAD_PASSWORD?.trim());
  }

  async login(options: ExecThreadLoginOptions): Promise<ExecThreadSessionData> {
    await this.request<Record<string, unknown>>("POST", "/auth", {
      email: options.email,
      password: options.password,
      linkedin: null,
      invite: null,
      redir: null,
      connectLoginMethod: null,
      appHash: null,
    });
    return this.getSession();
  }

  async searchListings(body: Record<string, unknown>): Promise<ExecThreadSearchResponse> {
    return this.request<ExecThreadSearchResponse>("POST", "/listings/search?source=kimchi-sync", body);
  }

  async getListingById(id: string): Promise<ExecThreadListingRaw> {
    return this.request<ExecThreadListingRaw>("GET", `/listings/getListingById?id=${encodeURIComponent(id)}`);
  }

  /** Public preview — full description, travel, industry, company copy (no auth). */
  async getPublicListingPreview(slug: string): Promise<ExecThreadListingRaw> {
    const trimmed = slug.trim();
    return this.request<ExecThreadListingRaw>(
      "GET",
      `/listings/public_listing_preview/${encodeURIComponent(trimmed)}`,
    );
  }

  /** Authenticated member view — recruiters, apply link after redeem. */
  async getMemberJob(id: string): Promise<ExecThreadMemberJobResponse> {
    return this.request<ExecThreadMemberJobResponse>("GET", `/members/jobs/${encodeURIComponent(id)}`);
  }

  /** Reveal confidential recruiter contacts / apply link (costs ET points on their platform). */
  async redeemListing(id: string, options: ExecThreadRedeemOptions = {}): Promise<ExecThreadRedeemResponse> {
    return this.request<ExecThreadRedeemResponse>("POST", "/members/redeem", {
      id,
      recruitersOrHiringManager: options.recruitersOrHiringManager ?? true,
      expressedInterest: options.expressedInterest ?? false,
      companyContact: options.companyContact ?? true,
    });
  }

  async fetchListingFullExport(searchRow: ExecThreadListingRaw): Promise<ExecThreadListingRaw> {
    const bundle: ExecThreadJobExportBundle = {
      searchRow,
      publicPreview: null,
      listingDetail: null,
      memberJob: null,
      redeem: null,
    };

    if (searchRow.slug?.trim()) {
      try {
        bundle.publicPreview = await this.getPublicListingPreview(searchRow.slug);
      } catch {
        // optional
      }
    }

    try {
      const detail = await this.getListingById(searchRow._id);
      if (!isSparseExecThreadListingDetail(detail)) {
        bundle.listingDetail = detail;
      }
    } catch {
      // optional
    }

    try {
      bundle.memberJob = await this.getMemberJob(searchRow._id);
    } catch {
      // optional when session missing
    }

    const mergedSoFar = mergeExecThreadJobExport(bundle);
    if (execThreadJobNeedsRedeem(mergedSoFar)) {
      try {
        bundle.redeem = await this.redeemListing(searchRow._id, {
          recruitersOrHiringManager: true,
          companyContact: true,
        });
        bundle.memberJob = await this.getMemberJob(searchRow._id);
      } catch {
        // redeem can fail when out of points — keep public/search data
      }
    }

    return mergeExecThreadJobExport(bundle);
  }

  /** Returns true if session cookies can load full listing detail. */
  async sessionLooksValid(): Promise<boolean> {
    try {
      const probe = await this.searchListings({ q: "all", sort: "most relevant", size: 1, from: 0 });
      const id = probe.results?.[0]?._id;
      if (!id) return this.cookies.length > 0;
      const detail = await this.getListingById(id);
      return Boolean(detail.title || detail.jobDescription);
    } catch {
      return false;
    }
  }

  async fetchListingsWithDetails(limit: number): Promise<ExecThreadListingRaw[]> {
    const searchBody = getDefaultSearchBody(limit);
    const search = await this.searchListings(searchBody);
    const summaries = (search.results ?? []).slice(0, limit);

    const merged: ExecThreadListingRaw[] = [];
    for (const row of summaries) {
      try {
        merged.push(await this.fetchListingFullExport(row));
      } catch {
        merged.push(row);
      }
    }
    return merged;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Origin: WEB_ORIGIN,
      Referer: `${WEB_ORIGIN}/listings`,
    };
    if (this.cookies.length) headers.Cookie = cookieHeader(this.cookies);

    const res = await fetch(url, {
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
      if (res.status === 401 && path !== "/auth") {
        throw new ExecThreadSessionExpiredError(text || "Unauthorized");
      }
      if (path === "/auth") {
        throw parseExecThreadAuthError(text, res.status);
      }
      throw new ExecThreadAuthError(text || `ExecThread API ${res.status}`);
    }

    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return {} as T;
    }
  }
}

export function getExecThreadCredentials(): ExecThreadLoginOptions | null {
  const email = process.env.EXECTHREAD_EMAIL?.trim();
  const password = process.env.EXECTHREAD_PASSWORD?.trim();
  if (!email || !password) return null;
  return { email, password };
}

export function execthreadConfigured(): boolean {
  return Boolean(getExecThreadCredentials());
}

function getDefaultSearchBody(limit: number): Record<string, unknown> {
  const raw = process.env.EXECTHREAD_SEARCH_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return { ...parsed, size: limit, from: 0 };
    } catch {
      // fall through
    }
  }
  return {
    q: "all",
    sort: "most relevant",
    size: limit,
    from: 0,
  };
}

export function getDefaultSearchBodyForExport(limit: number): Record<string, unknown> {
  return getDefaultSearchBody(limit);
}
