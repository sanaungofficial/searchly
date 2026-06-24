"use client";

import { useCallback, useEffect, useState } from "react";
import type { HirebaseCompanyProfileResponse } from "@/lib/hirebase-company-profile";

type State = {
  data: HirebaseCompanyProfileResponse | null;
  loading: boolean;
};

export function useHirebaseCompanyProfile(input: {
  companyName: string;
  website?: string | null;
  slugHint?: string | null;
  enabled?: boolean;
}) {
  const { companyName, website, slugHint, enabled = true } = input;
  const [state, setState] = useState<State>({ data: null, loading: false });

  const load = useCallback(async () => {
    const name = companyName.trim();
    if (!name || !enabled) {
      setState({ data: null, loading: false });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));
    try {
      const params = new URLSearchParams({ company: name });
      if (website?.trim()) params.set("website", website.trim());
      if (slugHint?.trim()) params.set("slug", slugHint.trim());

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
  }, [companyName, website, slugHint, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
