/** Shared helpers for onboarding typeahead + custom "Create …" rows. */

export function normalizeCustomLabel(input: string, maxLen = 80): string | null {
  const label = input.trim().replace(/\s+/g, " ");
  if (label.length < 2 || label.length > maxLen) return null;
  return label;
}

export function hasExactSuggestionMatch(query: string, options: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return options.some((option) => option.toLowerCase() === q);
}

export type SuggestDropdownRow =
  | { kind: "create"; value: string; label: string }
  | { kind: "option"; value: string };

export function buildSuggestDropdownRows(
  query: string,
  options: string[],
  createPrefix = "Create",
): SuggestDropdownRow[] {
  const normalized = normalizeCustomLabel(query);
  const exactMatch = hasExactSuggestionMatch(query, options);
  const rows: SuggestDropdownRow[] = [];

  if (normalized && !exactMatch) {
    rows.push({
      kind: "create",
      value: normalized,
      label: `${createPrefix} "${normalized}"`,
    });
  }

  for (const value of options) {
    rows.push({ kind: "option", value });
  }

  return rows;
}
