/**
 * @deprecated Hirebase Insights API (/v2/jobs/insights) is not used in Kimchi.
 * This module re-exports market trend types for legacy imports only.
 */
export type {
  HirebaseInsightsResponse,
  InsightsHeadline,
  InsightsKeyCount,
  InsightsTopCompany,
  InsightsTopLocation,
  MarketProjectTrend,
  MarketTrendsWindow,
} from "@/lib/market-trends-types";

export { buildMarketHeadline, formatInsightsSalary } from "@/lib/market-trends-types";
