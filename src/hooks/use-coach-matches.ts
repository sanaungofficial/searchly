"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
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
      };
      if (res.ok && Array.isArray(data.coaches)) {
        setCoaches(data.coaches);
        const scored = Boolean(data.scored);
        const needs = !scored;
        setNeedsProfile(needs);
        setProfileHint(
          needs ? "Add target roles or upload a resume in Profile to unlock coach match scores." : null,
        );
        writeCoachMatchCache({
          coaches: data.coaches,
          fetchedAt: Date.now(),
          scored,
          needsProfile: needs,
          hint: needs
            ? "Add target roles or upload a resume in Profile to unlock coach match scores."
            : null,
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
