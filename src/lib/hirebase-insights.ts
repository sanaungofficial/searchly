import { formatHirebaseErrorBody } from "@/lib/api-error-message";

const HIREBASE_BASE = "https://api.hirebase.org";

export type InsightsKeyCount = {
  key: string;
  count: number;
  percent?: number;
};

export type InsightsHeadline = {
  total_count?: number;
  sample_size?: number;
  median_salary?: number;
  salary_currency?: string;
  pct_disclosing_salary?: number;
  pct_remote?: number;
  top_company?: string;
  top_technology?: string;
  dominant_experience_level?: string;
  new_this_week?: number;
};

export type InsightsSalaryBand = {
  key: string;
  count?: number;
  p25?: number;
  p50?: number;
  p75?: number;
};

export type InsightsTopCompany = {
  company_name: string;
  company_slug: string;
  company_logo?: string | null;
  count: number;
  percent?: number;
};

export type InsightsTopLocation = {
  label: string;
  region?: string;
  country?: string;
  count: number;
  percent?: number;
};

export type HirebaseInsightsResponse = {
  headline?: InsightsHeadline;
  salary?: {
    count?: number;
    avg?: number;
    p25?: number;
    p50?: number;
    p75?: number;
    p90?: number;
    min?: number;
    max?: number;
    currency?: string;
    histogram?: Array<{ lower: number; upper: number; count: number }>;
    fitted_normal?: { mu?: number; sigma?: number };
  };
  salary_by_level?: InsightsSalaryBand[];
  salary_by_location_type?: InsightsSalaryBand[];
  top_technologies?: InsightsKeyCount[];
  top_skills?: InsightsKeyCount[];
  top_benefits?: InsightsKeyCount[];
  top_companies?: InsightsTopCompany[];
  top_locations?: InsightsTopLocation[];
  level_breakdown?: InsightsKeyCount[];
  location_type_split?: InsightsKeyCount[];
  job_type_split?: InsightsKeyCount[];
  industry_split?: InsightsKeyCount[];
  subindustry_split?: InsightsKeyCount[];
  company_size_split?: InsightsKeyCount[];
  education_split?: InsightsKeyCount[];
  visa_sponsorship_rate?: number;
  recruiter_agency_rate?: number;
  yoe_median?: number;
  freshness?: Record<string, unknown>;
  scores?: Record<string, number>;
  scores_by_level?: Array<Record<string, unknown>>;
  cached?: boolean;
  generated_at?: string;
};

export type MarketInsightsFilters = {
  job_titles?: string[];
  keywords?: string[];
  days_ago?: number;
  location_types?: string[];
  industries?: string[];
  experience?: string[];
  company_types?: string[];
};

async function insightsFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.HIREBASE_API_KEY?.trim();
  if (!key) throw new Error("HIREBASE_API_KEY is not configured.");

  const res = await fetch(`${HIREBASE_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatHirebaseErrorBody(text, res.status));
  }

  return res.json() as Promise<T>;
}

/** Aggregate market analytics for a search-shaped cohort. */
export async function fetchHirebaseMarketInsights(
  filters: MarketInsightsFilters
): Promise<HirebaseInsightsResponse> {
  const body: Record<string, unknown> = {};
  if (filters.job_titles?.length) body.job_titles = filters.job_titles;
  if (filters.keywords?.length) body.keywords = filters.keywords;
  if (filters.days_ago != null) body.days_ago = filters.days_ago;
  if (filters.location_types?.length) body.location_types = filters.location_types;
  if (filters.industries?.length) body.industries = filters.industries;
  if (filters.experience?.length) body.experience = filters.experience;
  if (filters.company_types?.length) body.company_types = filters.company_types;
  return insightsFetch<HirebaseInsightsResponse>("/v2/jobs/insights", body);
}

/** Company-scoped insights — same schema as market insights. */
export async function fetchHirebaseCompanyInsights(
  companySlug: string,
  filters: MarketInsightsFilters = {}
): Promise<HirebaseInsightsResponse> {
  const slug = companySlug.trim();
  if (!slug) throw new Error("Company slug is required.");

  const body: Record<string, unknown> = {};
  if (filters.job_titles?.length) body.job_titles = filters.job_titles;
  if (filters.keywords?.length) body.keywords = filters.keywords;
  if (filters.days_ago != null) body.days_ago = filters.days_ago;
  if (filters.location_types?.length) body.location_types = filters.location_types;

  return insightsFetch<HirebaseInsightsResponse>(
    `/v2/hirebase/companies/${encodeURIComponent(slug)}/insights`,
    body
  );
}

export function formatInsightsSalary(amount: number | undefined | null, currency = "USD"): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (currency === "USD" || !currency) {
    if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
    return `$${Math.round(amount).toLocaleString()}`;
  }
  return `${currency} ${Math.round(amount).toLocaleString()}`;
}

export function formatSalaryRange(
  low: number | undefined,
  high: number | undefined,
  currency = "USD"
): string | null {
  const a = formatInsightsSalary(low, currency);
  const b = formatInsightsSalary(high, currency);
  if (a && b) return `${a}–${b}`;
  if (a) return `${a}+`;
  if (b) return `Up to ${b}`;
  return null;
}

export function buildMarketHeadline(
  insights: HirebaseInsightsResponse,
  roleLabel: string,
  daysAgo: number
): string {
  const h = insights.headline;
  if (!h) return `Market snapshot for ${roleLabel} (last ${daysAgo} days).`;

  const parts: string[] = [];
  if (h.total_count != null) parts.push(`${h.total_count.toLocaleString()} active roles`);
  if (h.new_this_week != null && h.new_this_week > 0) {
    parts.push(`${h.new_this_week} posted this week`);
  }
  if (h.median_salary != null) {
    parts.push(`median ${formatInsightsSalary(h.median_salary, h.salary_currency ?? "USD")}`);
  }
  if (h.pct_remote != null) parts.push(`${Math.round(h.pct_remote)}% remote`);

  if (!parts.length) return `Market snapshot for ${roleLabel} (last ${daysAgo} days).`;
  return `${roleLabel}: ${parts.join(" · ")}.`;
}
