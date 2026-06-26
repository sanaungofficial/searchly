import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { formatProfileLocation } from "@/lib/recommended-filter-utils";
import { parseProfileLocationString } from "@/lib/profile-location";
import { createEmptyNetworkJobFilterForm, type NetworkJobFilterForm } from "@/lib/network-job-filters";

/** Map open-roles profile defaults into in-network filter form fields. */
export function networkFormFromProfileDefaults(
  defaults: VectorSearchFilters,
  targetRoles: string[],
): NetworkJobFilterForm {
  const form = createEmptyNetworkJobFilterForm();
  const loc = defaults.locations?.[0];
  const parsed = loc ? parseProfileLocationString(formatProfileLocation(loc)) : null;

  form.jobTitles = [...new Set([...(defaults.jobTitles ?? []), ...targetRoles])]
    .map((r) => r.trim())
    .filter(Boolean)
    .join(", ");

  if (parsed?.city) form.locationCity = parsed.city;
  if (parsed?.region) form.locationState = parsed.region;

  const remoteType = defaults.locationTypes?.find((t) => /remote|hybrid|on-?site/i.test(t));
  if (remoteType) form.remoteOption = remoteType;

  if (defaults.salaryFrom != null) form.salaryFrom = String(defaults.salaryFrom);

  return form;
}

export function describeNetworkActiveFilters(form: NetworkJobFilterForm): string[] {
  const labels: string[] = [];
  if (form.search.trim()) labels.push(`Search: ${form.search.trim()}`);
  if (form.jobTitles.trim()) labels.push(`Titles: ${form.jobTitles.trim()}`);
  if (form.keywords.trim()) labels.push(`Keywords: ${form.keywords.trim()}`);
  if (form.companyName.trim()) labels.push(`Company: ${form.companyName.trim()}`);
  if (form.industries.trim()) labels.push(`Industries: ${form.industries.trim()}`);
  if (form.locationCity.trim() || form.locationState.trim()) {
    labels.push(`Location: ${[form.locationCity, form.locationState].filter(Boolean).join(", ")}`);
  }
  if (form.remoteOption.trim()) labels.push(`Work: ${form.remoteOption.trim()}`);
  if (form.jobType.trim()) labels.push(`Type: ${form.jobType.trim()}`);
  if (form.channel.trim()) labels.push(`Channel: ${form.channel.trim()}`);
  if (form.salaryFrom.trim() || form.salaryTo.trim()) {
    labels.push(`Pay: ${form.salaryFrom || "0"}–${form.salaryTo || "∞"}`);
  }
  if (form.sharedAfter.trim()) labels.push(`Shared after ${form.sharedAfter.trim()}`);
  return labels;
}
