import { prisma } from "@/lib/prisma";
import { TOP_50_CATALOG, type CatalogCompany } from "@/lib/company-catalog";
import { findOrCreateCompanyIntel } from "@/lib/company-intel";
import {
  fetchHirebaseCompanyProfile,
  isHirebaseConfigured,
  type HirebaseCompanyProfile,
} from "@/lib/hirebase";

export type HirebaseEnrichmentMeta = {
  slug: string;
  logo: string | null;
  linkedinLink: string | null;
  jobBoard: string | null;
  subindustries: string[];
  totalOpenJobs: number | null;
  syncedAt: string;
};

export type CompanyEnrichmentCache = {
  description?: string | null;
  founded?: string | null;
  headquarters?: string | null;
  employeeCount?: string | null;
  industry?: string | null;
  fundingStage?: string | null;
  totalFunding?: string | null;
  keyInvestors?: string[];
  leadership?: Array<{ name: string; title: string }>;
  recentNews?: Array<{ title: string; date: string; summary: string }>;
  glassdoorRating?: string | null;
  websiteUrl?: string | null;
  hirebase?: HirebaseEnrichmentMeta;
  _primarySource?: "hirebase" | "ai";
};

export type HirebaseCompanySyncResult = {
  catalogSlug: string;
  name: string;
  ok: boolean;
  intelId?: string;
  hirebaseSlug?: string;
  jobBoard?: string | null;
  totalOpenJobs?: number | null;
  linkedinLink?: string | null;
  industries?: string[];
  error?: string;
};

function formatEmployeeRange(range: HirebaseCompanyProfile["size_range"]): string | null {
  if (!range) return null;
  const { min, max } = range;
  if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()}`;
  if (min != null) return `${min.toLocaleString()}+`;
  if (max != null) return `Up to ${max.toLocaleString()}`;
  return null;
}

function normalizeWebsiteUrl(link: string | null): string | null {
  if (!link?.trim()) return null;
  const trimmed = link.trim();
  if (trimmed.startsWith("http")) return trimmed;
  return `https://${trimmed}`;
}

export function enrichmentFromHirebaseProfile(profile: HirebaseCompanyProfile): CompanyEnrichmentCache {
  const syncedAt = new Date().toISOString();
  return {
    description: profile.description_summary,
    employeeCount: formatEmployeeRange(profile.size_range),
    industry: profile.industries[0] ?? null,
    websiteUrl: normalizeWebsiteUrl(profile.company_link),
    hirebase: {
      slug: profile.company_slug,
      logo: profile.company_logo,
      linkedinLink: profile.linkedin_link,
      jobBoard: profile.job_board,
      subindustries: profile.subindustries,
      totalOpenJobs: profile.sample_open_jobs > 0 ? profile.sample_open_jobs : null,
      syncedAt,
    },
    _primarySource: "hirebase",
  };
}

export function getHirebaseMetaFromEnrichment(raw: unknown): HirebaseEnrichmentMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const hirebase = (raw as CompanyEnrichmentCache).hirebase;
  if (!hirebase?.slug) return null;
  return hirebase;
}

export async function syncHirebaseCompanyFromCatalog(
  catalog: CatalogCompany
): Promise<HirebaseCompanySyncResult> {
  const base: HirebaseCompanySyncResult = {
    catalogSlug: catalog.slug,
    name: catalog.name,
    ok: false,
  };

  if (!isHirebaseConfigured()) {
    return { ...base, error: "HIREBASE_API_KEY is not configured." };
  }

  try {
    const profile = await fetchHirebaseCompanyProfile({
      companyName: catalog.name,
      slugHint: catalog.slug,
      website: catalog.website ?? null,
    });

    const intel = await findOrCreateCompanyIntel({
      name: catalog.name,
      slug: catalog.slug,
      website: normalizeWebsiteUrl(profile.company_link) ?? catalog.website ?? null,
      careersUrl: catalog.careersUrl ?? null,
    });

    const enrichment = enrichmentFromHirebaseProfile(profile);
    const now = new Date();

    await prisma.companyIntel.update({
      where: { id: intel.id },
      data: {
        name: profile.company_name || catalog.name,
        website: intel.website ?? normalizeWebsiteUrl(profile.company_link) ?? catalog.website ?? null,
        enrichmentCache: enrichment,
        enrichmentFetchedAt: now,
      },
    });

    return {
      ...base,
      ok: true,
      intelId: intel.id,
      hirebaseSlug: profile.company_slug,
      jobBoard: profile.job_board,
      totalOpenJobs: profile.sample_open_jobs > 0 ? profile.sample_open_jobs : null,
      linkedinLink: profile.linkedin_link,
      industries: profile.industries,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Hirebase sync failed.",
    };
  }
}

export async function syncTop50HirebaseCompanies(): Promise<{
  synced: number;
  failed: number;
  results: HirebaseCompanySyncResult[];
}> {
  const results: HirebaseCompanySyncResult[] = [];

  for (const catalog of TOP_50_CATALOG) {
    const result = await syncHirebaseCompanyFromCatalog(catalog);
    results.push(result);
    await new Promise((r) => setTimeout(r, 150));
  }

  return {
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
