export type SumbleBriefCache = {
  organizationId: number;
  organizationSlug: string;
  organizationName?: string | null;
  briefId: string;
  title: string;
  body: string;
  sumbleUrl: string;
  fetchedAt: string;
};

export function getSumbleBriefFromEnrichment(raw: unknown): SumbleBriefCache | null {
  if (!raw || typeof raw !== "object") return null;
  const brief = (raw as { sumbleBrief?: unknown }).sumbleBrief;
  if (!brief || typeof brief !== "object") return null;
  const b = brief as Partial<SumbleBriefCache>;
  if (
    typeof b.organizationId !== "number" ||
    typeof b.briefId !== "string" ||
    typeof b.title !== "string" ||
    typeof b.body !== "string" ||
    typeof b.sumbleUrl !== "string" ||
    typeof b.fetchedAt !== "string"
  ) {
    return null;
  }
  return {
    organizationId: b.organizationId,
    organizationSlug: b.organizationSlug ?? String(b.organizationId),
    organizationName: b.organizationName ?? null,
    briefId: b.briefId,
    title: b.title,
    body: b.body,
    sumbleUrl: b.sumbleUrl,
    fetchedAt: b.fetchedAt,
  };
}

export function mergeSumbleBriefIntoEnrichment(
  existing: unknown,
  brief: SumbleBriefCache,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, sumbleBrief: brief };
}
