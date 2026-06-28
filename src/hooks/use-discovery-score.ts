"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscoveryScoreInput, DiscoveryScoreResult } from "@/lib/discovery-score";
import {
  readDiscoveryScoreCache,
  writeDiscoveryScoreCache,
} from "@/lib/discovery-score-cache";

type Options = {
  input: DiscoveryScoreInput;
  withClientScope: (path: string) => string;
  hasAccess: boolean;
  isLoggedIn: boolean;
  subLoading: boolean;
  onSubscribe?: () => void;
};

export function useDiscoveryScore({
  input,
  withClientScope,
  hasAccess,
  isLoggedIn,
  subLoading,
  onSubscribe,
}: Options) {
  const cached = readDiscoveryScoreCache();
  const [result, setResult] = useState<DiscoveryScoreResult | null>(() => cached?.result ?? null);
  const [loading, setLoading] = useState(() => isLoggedIn && hasAccess && !subLoading && !cached);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(() => cached?.fetchedAt ?? null);

  const fetchScore = useCallback(
    async (force: boolean) => {
      if (!isLoggedIn || !hasAccess || subLoading) return;

      if (!force) {
        const hit = readDiscoveryScoreCache();
        if (hit) {
          setResult(hit.result);
          setFetchedAt(hit.fetchedAt);
          setLoading(false);
          return;
        }
      }

      if (result) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await fetch(withClientScope("/api/discovery-score"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          cache: force ? "no-store" : "default",
        });
        const data = res.ok ? await res.json() : null;
        if (data && typeof data.score === "number") {
          const next = data as DiscoveryScoreResult;
          const at = Date.now();
          setResult(next);
          setFetchedAt(at);
          writeDiscoveryScoreCache({ result: next, fetchedAt: at });
        }
      } catch {
        /* keep existing result */
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hasAccess, input, isLoggedIn, result, subLoading, withClientScope],
  );

  useEffect(() => {
    if (!isLoggedIn || (!hasAccess && !subLoading)) {
      setLoading(false);
      return;
    }
    if (!hasAccess || subLoading) return;
    void fetchScore(false);
  }, [fetchScore, hasAccess, isLoggedIn, subLoading]);

  const refresh = useCallback(() => {
    if (!hasAccess) {
      onSubscribe?.();
      return;
    }
    void fetchScore(true);
  }, [fetchScore, hasAccess, onSubscribe]);

  return { result, loading, refreshing, refresh, fetchedAt };
}
