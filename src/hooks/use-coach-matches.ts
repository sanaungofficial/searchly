"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { COACH_MATCH_NEEDS_SIGNAL_HINT } from "@/lib/coach-goal-signals";
import { topMatchedCoach } from "@/lib/coach-match";
import type { CoachListItem } from "@/lib/coach-types";
import {
  readCoachMatchCache,
  writeCoachMatchCache,
} from "@/lib/coach-match-cache";

export function useCoachMatches() {
  const { actingUserId } = useWorkspace();
  const [coaches, setCoaches] = useState<CoachListItem[]>(() => readCoachMatchCache()?.coaches ?? []);
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
      const res = await fetch("/api/coaches");
      const data = (await res.json()) as {
        coaches?: CoachListItem[];
        scored?: boolean;
        hint?: string | null;
      };
      if (res.ok && Array.isArray(data.coaches)) {
        setCoaches(data.coaches);
        const scored = Boolean(data.scored);
        const hint = scored ? null : (data.hint ?? COACH_MATCH_NEEDS_SIGNAL_HINT);
        setNeedsProfile(!scored);
        setProfileHint(hint);
        writeCoachMatchCache({
          coaches: data.coaches,
          fetchedAt: Date.now(),
          scored,
          needsProfile: !scored,
          hint,
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
