import { getCatalogCompany, normalizeCompanySlug } from "@/lib/company-catalog";

export function hostnameFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Best domain for logo lookup — website first, then enrichment, catalog, then careers host. */
export function extractCompanyDomain(input: {
  name?: string | null;
  website?: string | null;
  careersUrl?: string | null;
  enrichmentWebsiteUrl?: string | null;
}): string | null {
  const fromWebsite = hostnameFromUrl(input.website);
  if (fromWebsite) return fromWebsite;

  const fromEnrichment = hostnameFromUrl(input.enrichmentWebsiteUrl);
  if (fromEnrichment) return fromEnrichment;

  if (input.name?.trim()) {
    const catalog = getCatalogCompany(normalizeCompanySlug(input.name));
    if (catalog?.website) {
      const fromCatalog = hostnameFromUrl(catalog.website);
      if (fromCatalog) return fromCatalog;
    }
  }

  const careersHost = hostnameFromUrl(input.careersUrl);
  if (!careersHost) return null;

  const atsHosts = new Set([
    "boards.greenhouse.io",
    "jobs.lever.co",
    "jobs.ashbyhq.com",
    "myworkdayjobs.com",
    "wd1.myworkdayjobs.com",
    "wd3.myworkdayjobs.com",
    "wd5.myworkdayjobs.com",
    "smartrecruiters.com",
    "icims.com",
  ]);
  if (atsHosts.has(careersHost) || careersHost.endsWith(".myworkdayjobs.com")) {
    return null;
  }

  return careersHost;
}

export function companyLogoUrls(domain: string): { primary: string; fallback: string } {
  return {
    primary: `https://logo.clearbit.com/${domain}`,
    fallback: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  };
}
