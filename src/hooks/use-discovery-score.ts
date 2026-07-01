"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscoveryScoreResult } from "@/lib/discovery-score";
import type { DiscoveryScoreApiResponse, DiscoveryScoreCachePayload } from "@/lib/discovery-score/types";

type Options = {
  withClientScope: (path: string) => string;
};

function payloadToResult(payload: DiscoveryScoreCachePayload): DiscoveryScoreResult {
  return {
    score: payload.score,
    percentile: payload.percentile,
    breakdown: payload.breakdown,
    tier: payload.tier,
    summary: payload.summary,
    topImprovement: payload.topImprovement,
    strengths: payload.strengths,
    gaps: payload.gaps,
    benchmarks: payload.benchmarks,
    refreshedAt: payload.refreshedAt,
  };
}

export function useDiscoveryScore({ withClientScope }: Options) {
  const [result, setResult] = useState<DiscoveryScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyResponse = useCallback((data: DiscoveryScoreApiResponse | null) => {
    if (!data) return;
    setError(data.error ?? null);
    if (data.result) setResult(payloadToResult(data.result));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(withClientScope("/api/profile/discovery-score"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DiscoveryScoreApiResponse | null) => {
        if (!cancelled) applyResponse(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Discovery Score.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyResponse, withClientScope]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(withClientScope("/api/profile/discovery-score"), {
        method: "POST",
        cache: "no-store",
      });
      const data = res.ok ? ((await res.json()) as DiscoveryScoreApiResponse) : null;
      applyResponse(data);
      if (!res.ok) setError("Refresh failed. Try again in a moment.");
    } catch {
      setError("Refresh failed. Try again in a moment.");
    } finally {
      setRefreshing(false);
    }
  }, [applyResponse, withClientScope]);

  return { result, loading, refreshing, refresh, error };
}
