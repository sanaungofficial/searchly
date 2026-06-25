"use client";

import { useCallback, useEffect, useState } from "react";
import type { HirebaseCompanyProfile } from "@/lib/hirebase";
import type { HirebaseCompanyProfileResponse } from "@/lib/hirebase-company-profile";
import { enrichmentFromHirebaseProfile } from "@/lib/hirebase-company-sync";

type State = {
  data: HirebaseCompanyProfileResponse | null;
  loading: boolean;
};

export function useHirebaseCompanyProfile(input: {
  companyName: string;
  website?: string | null;
  slugHint?: string | null;
  trackedId?: string | null;
  initialProfile?: HirebaseCompanyProfile | null;
  enabled?: boolean;
}) {
  const { companyName, website, slugHint, trackedId, initialProfile, enabled = true } = input;
  const [state, setState] = useState<State>(() => {
    if (initialProfile) {
      return {
        data: {
          configured: true,
          profile: initialProfile,
          enrichment: enrichmentFromHirebaseProfile(initialProfile),
          cached: true,
        },
        loading: false,
      };
    }
    return { data: null, loading: false };
  });

  const load = useCallback(async () => {
    const name = companyName.trim();
    if (!name || !enabled) {
      setState({ data: null, loading: false });
      return;
    }

    if (initialProfile) {
      setState({
        data: {
          configured: true,
          profile: initialProfile,
          enrichment: enrichmentFromHirebaseProfile(initialProfile),
          cached: true,
        },
        loading: false,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    try {
      const params = new URLSearchParams({ company: name });
      if (website?.trim()) params.set("website", website.trim());
      if (slugHint?.trim()) params.set("slug", slugHint.trim());
      if (trackedId?.trim()) params.set("trackedId", trackedId.trim());

      const res = await fetch(`/api/companies/hirebase-profile?${params}`, {
        signal: AbortSignal.timeout(20000),
      });
      const data = (await res.json().catch(() => null)) as HirebaseCompanyProfileResponse | null;
      if (!res.ok || !data) {
        setState({
          data: {
            configured: true,
            profile: null,
            enrichment: null,
            error: (data as { error?: string } | null)?.error ?? "Couldn't load company profile.",
          },
          loading: false,
        });
        return;
      }
      setState({ data, loading: false });
    } catch {
      setState({
        data: {
          configured: true,
          profile: null,
          enrichment: null,
          error: "Network error — couldn't load company profile.",
        },
        loading: false,
      });
    }
  }, [companyName, website, slugHint, trackedId, initialProfile, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
};
