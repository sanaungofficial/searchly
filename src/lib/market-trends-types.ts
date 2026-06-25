/** Shared shapes for Sumble-derived market trend snapshots (not Hirebase Insights). */

export type InsightsKeyCount = {
  key: string;
  count: number;
  percent?: number;
};

export type InsightsHeadline = {
  total_count?: number;
  sample_size?: number;
  new_this_week?: number;
  pct_remote?: number;
  top_company?: string;
  top_technology?: string;
  dominant_experience_level?: string;
  /** Share of sample jobs mentioning AI / automation themes */
  pct_ai_related?: number;
  ai_related_count?: number;
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

export type MarketProjectTrend = {
  key: string;
  name: string;
  goal: string | null;
  count: number;
  percent?: number;
};

/** One time-window snapshot built from Sumble job postings. */
export type MarketTrendsWindow = {
  headline?: InsightsHeadline;
  top_technologies?: InsightsKeyCount[];
  top_skills?: InsightsKeyCount[];
  top_companies?: InsightsTopCompany[];
  top_locations?: InsightsTopLocation[];
  top_projects?: MarketProjectTrend[];
  ai_technologies?: InsightsKeyCount[];
  level_breakdown?: InsightsKeyCount[];
  location_type_split?: InsightsKeyCount[];
  generated_at?: string;
  cached?: boolean;
};

/** @deprecated Use MarketTrendsWindow — kept for gradual migration */
export type HirebaseInsightsResponse = MarketTrendsWindow;

export function formatInsightsSalary(amount: number | undefined | null, currency = "USD"): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (currency === "USD" || !currency) {
    if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
    return `$${Math.round(amount).toLocaleString()}`;
  }
  return `${currency} ${Math.round(amount).toLocaleString()}`;
}

export function buildMarketHeadline(
  insight: MarketTrendsWindow,
  roleLabel: string,
  daysAgo: number
): string {
  const h = insight.headline;
  if (!h) return `Job market trends for ${roleLabel} (last ${daysAgo} days).`;

  const parts: string[] = [];
  if (h.total_count != null) parts.push(`${h.total_count.toLocaleString()} active roles`);
  if (h.sample_size != null) parts.push(`${h.sample_size} postings analyzed`);
  if (h.new_this_week != null && h.new_this_week > 0) {
    parts.push(`${h.new_this_week} new this week in sample`);
  }
  if (h.pct_ai_related != null && h.pct_ai_related > 0) {
    parts.push(`${Math.round(h.pct_ai_related)}% mention AI/automation`);
  }
  if (h.pct_remote != null) parts.push(`${Math.round(h.pct_remote)}% remote`);

  if (!parts.length) return `Job market trends for ${roleLabel} (last ${daysAgo} days).`;
  return `${roleLabel}: ${parts.join(" · ")}.`;
}
