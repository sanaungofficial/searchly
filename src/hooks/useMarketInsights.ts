"use client";

import { useCallback, useEffect, useState } from "react";
import type { HirebaseInsightsResponse } from "@/lib/hirebase-insights";
import { MARKET_WINDOW_OPTIONS } from "@/lib/market-insights-service";

export type MarketInsightsPayload = {
  configured: boolean;
  dataSource?: "sumble" | "none";
  targetRoles: string[];
  roleLabel: string;
  windows: Record<string, HirebaseInsightsResponse>;
  primaryDays: number;
  headline: string;
  generatedAt: string | null;
  /** @deprecated use dataSource */
  hirebaseCached: boolean;
  serverCached: boolean;
  creditsRemaining?: number | null;
  error?: string;
};

export function useMarketInsights(primaryDays: number, windows = "7,30,90") {
  const [data, setData] = useState<MarketInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          days: String(primaryDays),
          windows,
        });
        if (refresh) params.set("refresh", "1");
        const res = await fetch(`/api/market/insights?${params}`);
        const body = (await res.json()) as MarketInsightsPayload;
        if (!res.ok && !body.windows) {
          setError(body.error ?? "Could not load market data.");
          setData(body);
        } else {
          setData(body);
          if (body.error) setError(body.error);
        }
      } catch {
        setError("Network error loading market insights.");
      } finally {
        setLoading(false);
      }
    },
    [primaryDays, windows]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return { data, loading, error, refresh: () => load(true) };
}

export function windowInsight(
  payload: MarketInsightsPayload | null,
  days: number
): HirebaseInsightsResponse | null {
  if (!payload?.windows) return null;
  return payload.windows[String(days)] ?? null;
}

export function trendDelta(
  payload: MarketInsightsPayload | null,
  shortDays: number,
  longDays: number,
  pick: (i: HirebaseInsightsResponse) => number | undefined
): { short: number | null; long: number | null; delta: number | null; pct: number | null } {
  const a = windowInsight(payload, shortDays);
  const b = windowInsight(payload, longDays);
  const short = pick(a ?? {}) ?? null;
  const long = pick(b ?? {}) ?? null;
  if (short == null || long == null) return { short, long, delta: null, pct: null };
  const delta = short - long;
  const pct = long !== 0 ? Math.round((delta / long) * 100) : null;
  return { short, long, delta, pct };
}

export { MARKET_WINDOW_OPTIONS };
