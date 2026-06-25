"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import type { MatchedCoach } from "@/lib/coach-match";
import { topMatchedCoach } from "@/lib/coach-match";
import {
  readCoachMatchCache,
  writeCoachMatchCache,
} from "@/lib/coach-match-cache";

export function useCoachMatches() {
  const { actingUserId } = useWorkspace();
  const [coaches, setCoaches] = useState<MatchedCoach[]>(() => readCoachMatchCache()?.coaches ?? []);
  const [loading, setLoading] = useState(() => !readCoachMatchCache());
  const [needsProfile, setNeedsProfile] = useState(() => readCoachMatchCache()?.needsProfile ?? false);
  const [profileHint, setProfileHint] = useState<string | null>(() => readCoachMatchCache()?.hint ?? null);

  const loadCoaches = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force) {
      const cached = readCoachMatchCache();
      if (cached) {
        setCoaches(cached.coaches);
        setNeedsProfile(Boolean(cached.needsProfile));
        setProfileHint(cached.hint ?? null);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/coaches/match");
      const data = (await res.json()) as {
        coaches?: MatchedCoach[];
        needsProfile?: boolean;
        hint?: string;
        scored?: boolean;
      };
      if (res.ok && Array.isArray(data.coaches)) {
        setCoaches(data.coaches);
        setNeedsProfile(Boolean(data.needsProfile));
        setProfileHint(data.hint ?? null);
        writeCoachMatchCache({
          coaches: data.coaches,
          fetchedAt: Date.now(),
          scored: Boolean(data.scored),
          needsProfile: data.needsProfile,
          hint: data.hint ?? null,
        });
      }
    } catch {
      /* keep existing list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readCoachMatchCache();
    if (cached) {
      setCoaches(cached.coaches);
      setNeedsProfile(Boolean(cached.needsProfile));
      setProfileHint(cached.hint ?? null);
      setLoading(false);
    } else {
      void loadCoaches();
    }
  }, [actingUserId, loadCoaches]);

  const myCoach = useMemo(() => topMatchedCoach(coaches), [coaches]);

  return {
    coaches,
    loading,
    needsProfile,
    profileHint,
    myCoach,
    refresh: () => loadCoaches({ force: true }),
  };
}
