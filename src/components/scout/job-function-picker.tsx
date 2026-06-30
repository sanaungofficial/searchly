"use client";

import { useEffect, useMemo, useState } from "react";
import { JobFunctionDropdown } from "@/components/scout/job-function-dropdown";
import type { GroupedJobFunctions } from "@/lib/job-function-groups";

type JobFunctionPickerProps = {
  selected: string[];
  onChange: (next: string[]) => void;
  /** @deprecated No suggestions — Jobright-style search only. */
  suggested?: string[];
  /** Onboarding vs profile styling (both use Jobright layout now). */
  variant?: "onboarding" | "profile";
  maxSelections?: number;
  showLabel?: boolean;
  fullWidth?: boolean;
};

export function JobFunctionPicker({
  selected,
  onChange,
  variant: _variant = "profile",
  maxSelections = 12,
  showLabel = true,
  fullWidth = false,
}: JobFunctionPickerProps) {
  const [flatCategories, setFlatCategories] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/jobs/job-functions")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data: { categories?: string[]; groups?: GroupedJobFunctions[] }) => {
        const fromFlat = data.categories ?? [];
        const fromGroups = (data.groups ?? []).flatMap((g) => g.categories);
        setFlatCategories(fromFlat.length ? fromFlat : fromGroups);
      })
      .catch(() => {});
  }, []);

  const taxonomyLower = useMemo(
    () => new Set(flatCategories.map((c) => c.toLowerCase())),
    [flatCategories],
  );

  const taxonomySelected = useMemo(
    () => selected.filter((s) => taxonomyLower.has(s.toLowerCase())),
    [selected, taxonomyLower],
  );

  const customSelected = useMemo(
    () => selected.filter((s) => !taxonomyLower.has(s.toLowerCase())),
    [selected, taxonomyLower],
  );

  return (
    <JobFunctionDropdown
      selected={taxonomySelected}
      customSelected={customSelected}
      onChange={(taxonomy, custom) => onChange([...taxonomy, ...custom])}
      maxSelections={maxSelections}
      showLabel={showLabel}
      fullWidth={fullWidth}
    />
  );
}
