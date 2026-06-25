"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MarketInsightsPayload } from "@/hooks/useMarketInsights";

type MarketInsightsContextValue = {
  primaryDays: number;
  setPrimaryDays: (days: number) => void;
  windows: string;
  data: MarketInsightsPayload | null;
  loading: boolean;
  error: string | null;
  requiresLoad: boolean;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
};

const MarketInsightsContext = createContext<MarketInsightsContextValue | null>(null);

export function MarketInsightsProvider({
  children,
  defaultDays = 30,
  windows = "7,30,90,180",
}: {
  children: React.ReactNode;
  defaultDays?: number;
  windows?: string;
}) {
  const [primaryDays, setPrimaryDays] = useState(defaultDays);
  const [data, setData] = useState<MarketInsightsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchInsights = useCallback(
    async (options?: { refresh?: boolean; fetch?: boolean }) => {
      const refresh = options?.refresh ?? false;
      const fetch = options?.fetch ?? refresh;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          days: String(primaryDays),
          windows,
        });
        if (fetch) params.set("load", "1");
        if (refresh) params.set("refresh", "1");
        const res = await fetch(`/api/market/insights?${params}`);
        const body = (await res.json()) as MarketInsightsPayload;
        setData(body);
        if (!res.ok && !Object.keys(body.windows ?? {}).length && !body.requiresLoad) {
          setError(body.error ?? "Could not load market data.");
        } else if (body.error) {
          setError(body.error);
        } else {
          setError(null);
        }
        if (Object.keys(body.windows ?? {}).length) setHasLoaded(true);
      } catch {
        setError("Network error loading market insights.");
      } finally {
        setLoading(false);
      }
    },
    [primaryDays, windows]
  );

  useEffect(() => {
    void fetchInsights({ fetch: false });
  }, [fetchInsights]);

  const value = useMemo<MarketInsightsContextValue>(
    () => ({
      primaryDays,
      setPrimaryDays,
      windows,
      data,
      loading,
      error,
      requiresLoad: data?.requiresLoad ?? !hasLoaded,
      load: async () => {
        await fetchInsights({ fetch: true });
      },
      refresh: async () => {
        await fetchInsights({ fetch: true, refresh: true });
      },
    }),
    [primaryDays, windows, data, loading, error, hasLoaded, fetchInsights]
  );

  return <MarketInsightsContext.Provider value={value}>{children}</MarketInsightsContext.Provider>;
}

export function useSharedMarketInsights() {
  const ctx = useContext(MarketInsightsContext);
  if (!ctx) {
    throw new Error("useSharedMarketInsights must be used within MarketInsightsProvider");
  }
  return ctx;
}
