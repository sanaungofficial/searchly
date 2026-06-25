/** Shared preference labels — keep in sync with Profile → Preferences. */
export const RECOMMENDATION_LOCATION_PRIORITIES = [
  "Remote-first",
  "Hybrid-friendly",
] as const;

export const RECOMMENDATION_RELOCATION_PRIORITIES = [
  "Open to relocating within my country",
  "Open to relocating internationally",
] as const;

export const PIPELINE_RECOMMENDATION_PRIORITIES = [
  ...RECOMMENDATION_LOCATION_PRIORITIES,
  ...RECOMMENDATION_RELOCATION_PRIORITIES,
] as const;

export type PipelineRecommendationPriority = (typeof PIPELINE_RECOMMENDATION_PRIORITIES)[number];

export type RecommendationPreferencesState = {
  location: string;
  priorities: string[];
};

export function mergeRecommendationPriorities(
  current: string[],
  toggle: string,
  enabled: boolean,
): string[] {
  const set = new Set(current);
  if (enabled) set.add(toggle);
  else set.delete(toggle);
  // Relocation tiers are mutually exclusive — pick the most permissive selected.
  if (toggle === "Open to relocating internationally" && enabled) {
    set.delete("Open to relocating within my country");
  }
  if (toggle === "Open to relocating within my country" && enabled) {
    set.delete("Open to relocating internationally");
  }
  return [...set];
}
