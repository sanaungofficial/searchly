import { prisma } from "@/lib/prisma";
import { normalizeCompanySlug, getCatalogCompany } from "@/lib/company-catalog";
import { resolveCompanyIntelFromInput } from "@/lib/company-intel";
import { hydrateIntelFromHirebase, normalizeWebsiteUrl } from "@/lib/hirebase-company-sync";
import type { IntakeParseResult } from "@/lib/career-strategy";

export type SuggestedTrackedCompany = {
  name: string;
  priority?: string | null;
  notes?: string | null;
  candidateEdge?: string | null;
};

export type IntakeCompaniesApplyResult = {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
};

function normalizePriority(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim().toLowerCase();
  if (v === "high" || v === "a" || v === "tier 1" || v === "tier a" || v === "1") return "HIGH";
  if (v === "medium" || v === "b" || v === "tier 2" || v === "tier b" || v === "2") return "MEDIUM";
  if (v === "low" || v === "c" || v === "tier 3" || v === "tier c" || v === "3") return "LOW";
  const upper = value.trim().toUpperCase();
  if (upper === "HIGH" || upper === "MEDIUM" || upper === "LOW") return upper;
  return value.trim();
}

function parseCompanyEntry(item: unknown): SuggestedTrackedCompany | null {
  if (typeof item === "string") {
    const name = item.trim();
    return name ? { name } : null;
  }
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const name = String(row.name ?? row.company ?? row.companyName ?? "").trim();
  if (!name) return null;
  return {
    name,
    priority: row.priority != null ? String(row.priority) : null,
    notes: row.notes != null ? String(row.notes) : row.rationale != null ? String(row.rationale) : null,
    candidateEdge:
      row.candidateEdge != null
        ? String(row.candidateEdge)
        : row.edge != null
          ? String(row.edge)
          : row.why != null
            ? String(row.why)
            : null,
  };
}

/** Merge dream-company names and rich tracked-company rows from intake parse output. */
export function normalizeSuggestedTrackedCompanies(input: {
  suggestedDreamCompanies?: unknown;
  suggestedTrackedCompanies?: unknown;
}): SuggestedTrackedCompany[] {
  const byKey = new Map<string, SuggestedTrackedCompany>();

  function add(entry: SuggestedTrackedCompany) {
    const name = entry.name.trim();
    if (!name) return;
    const key = name.toLowerCase();
    const existing = byKey.get(key);
    byKey.set(key, {
      name,
      priority: normalizePriority(entry.priority ?? existing?.priority),
      notes: entry.notes?.trim() || existing?.notes || null,
      candidateEdge: entry.candidateEdge?.trim() || existing?.candidateEdge || null,
    });
  }

  const dreamList = Array.isArray(input.suggestedDreamCompanies) ? input.suggestedDreamCompanies : [];
  for (const item of dreamList) {
    const parsed = parseCompanyEntry(item);
    if (parsed) add({ ...parsed, priority: parsed.priority ?? "HIGH" });
  }

  const trackedList = Array.isArray(input.suggestedTrackedCompanies) ? input.suggestedTrackedCompanies : [];
  for (const item of trackedList) {
    const parsed = parseCompanyEntry(item);
    if (parsed) add(parsed);
  }

  return [...byKey.values()];
}

export function mergeIntakeTrackedCompanies(result: IntakeParseResult): SuggestedTrackedCompany[] {
  return normalizeSuggestedTrackedCompanies(result);
}

async function findExistingWatchlistCompany(
  userId: string,
  input: { intelId?: string | null; catalogSlug?: string | null; name?: string | null },
) {
  const slug =
    input.catalogSlug?.trim() ||
    (input.name?.trim() ? normalizeCompanySlug(input.name) : null);
  const catalog = slug ? getCatalogCompany(slug) : undefined;
  const nameCandidates = [input.name?.trim(), catalog?.name].filter(Boolean) as string[];

  const or: Array<Record<string, unknown>> = [];
  if (input.intelId) or.push({ companyIntelId: input.intelId });
  if (slug) or.push({ companyIntel: { slug } });
  for (const candidate of nameCandidates) {
    or.push({ name: { equals: candidate, mode: "insensitive" } });
  }

  if (!or.length) return null;

  return prisma.trackedCompany.findFirst({
    where: { userId, OR: or },
  });
}

async function createTrackedCompany(userId: string, entry: SuggestedTrackedCompany) {
  const intel = await resolveCompanyIntelFromInput({ name: entry.name });
  const catalogSlug = normalizeCompanySlug(entry.name);
  const catalogEntry = getCatalogCompany(catalogSlug);

  let hydratedIntel = intel;
  if (intel) {
    hydratedIntel = await hydrateIntelFromHirebase(intel, {
      slugHint: catalogSlug || intel.slug,
      website: intel.website,
      force: true,
    });
  }

  const enrichmentIndustry =
    hydratedIntel?.enrichmentCache &&
    typeof hydratedIntel.enrichmentCache === "object" &&
    !Array.isArray(hydratedIntel.enrichmentCache)
      ? ((hydratedIntel.enrichmentCache as { industry?: string | null }).industry ?? null)
      : null;
  const enrichmentWebsite =
    hydratedIntel?.enrichmentCache &&
    typeof hydratedIntel.enrichmentCache === "object" &&
    !Array.isArray(hydratedIntel.enrichmentCache)
      ? normalizeWebsiteUrl((hydratedIntel.enrichmentCache as { websiteUrl?: string | null }).websiteUrl)
      : null;

  return prisma.trackedCompany.create({
    data: {
      userId,
      companyIntelId: hydratedIntel?.id ?? null,
      name: hydratedIntel?.name ?? entry.name,
      website: hydratedIntel?.website ?? enrichmentWebsite ?? null,
      careersUrl: hydratedIntel?.careersUrl ?? null,
      notes: entry.notes ?? null,
      type: enrichmentIndustry ?? catalogEntry?.type ?? null,
      priority: normalizePriority(entry.priority),
      candidateEdge: entry.candidateEdge ?? null,
      enrichmentCache: hydratedIntel?.enrichmentCache ?? undefined,
      enrichmentFetchedAt: hydratedIntel?.enrichmentFetchedAt ?? null,
    },
  });
}

/** Upsert target companies from intake parse — creates new rows and enriches existing matches. */
export async function applyIntakeTrackedCompanies(
  userId: string,
  companies: SuggestedTrackedCompany[],
  options?: { max?: number },
): Promise<IntakeCompaniesApplyResult> {
  const max = options?.max ?? 40;
  const result: IntakeCompaniesApplyResult = { added: 0, updated: 0, skipped: 0, errors: [] };

  for (const entry of companies.slice(0, max)) {
    const name = entry.name.trim();
    if (!name) {
      result.skipped++;
      continue;
    }

    try {
      const intel = await resolveCompanyIntelFromInput({ name });
      const existing = await findExistingWatchlistCompany(userId, {
        intelId: intel?.id,
        name: intel?.name ?? name,
      });

      if (existing) {
        const patch: Record<string, string | null> = {};
        const priority = normalizePriority(entry.priority);
        if (priority && priority !== existing.priority) patch.priority = priority;
        if (entry.notes?.trim() && entry.notes.trim() !== (existing.notes ?? "")) patch.notes = entry.notes.trim();
        if (entry.candidateEdge?.trim() && entry.candidateEdge.trim() !== (existing.candidateEdge ?? "")) {
          patch.candidateEdge = entry.candidateEdge.trim();
        }

        if (Object.keys(patch).length > 0) {
          await prisma.trackedCompany.update({ where: { id: existing.id }, data: patch });
          result.updated++;
        } else {
          result.skipped++;
        }
        continue;
      }

      await createTrackedCompany(userId, entry);
      result.added++;
    } catch (err) {
      console.error("[applyIntakeTrackedCompanies]", name, err);
      result.errors.push(name);
    }
  }

  return result;
}
