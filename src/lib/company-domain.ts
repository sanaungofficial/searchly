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

/** Hosts that host job postings, not the employer — skip for logo lookup. */
export function isJobBoardOrAtsHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (host.endsWith(".myworkdayjobs.com") || host === "myworkdayjobs.com") return true;
  if (/workday/i.test(host)) return true;

  const exact = new Set([
    "boards.greenhouse.io",
    "jobs.lever.co",
    "jobs.ashbyhq.com",
    "smartrecruiters.com",
    "icims.com",
    "linkedin.com",
    "indeed.com",
    "glassdoor.com",
    "ziprecruiter.com",
    "monster.com",
    "job-boards.greenhouse.io",
  ]);
  if (exact.has(host)) return true;

  return /\.(greenhouse\.io|lever\.co|ashbyhq\.com)$/.test(host);
}

function hostnameForLogo(url: string | null | undefined): string | null {
  const host = hostnameFromUrl(url);
  if (!host || isJobBoardOrAtsHost(host)) return null;
  return host;
}

/** Best domain for logo lookup — website first, then enrichment, catalog, then careers host. */
export function extractCompanyDomain(input: {
  name?: string | null;
  website?: string | null;
  careersUrl?: string | null;
  enrichmentWebsiteUrl?: string | null;
}): string | null {
  const fromWebsite = hostnameForLogo(input.website);
  if (fromWebsite) return fromWebsite;

  const fromEnrichment = hostnameForLogo(input.enrichmentWebsiteUrl);
  if (fromEnrichment) return fromEnrichment;

  if (input.name?.trim()) {
    const catalog = getCatalogCompany(normalizeCompanySlug(input.name));
    if (catalog?.website) {
      const fromCatalog = hostnameFromUrl(catalog.website);
      if (fromCatalog) return fromCatalog;
    }
  }

  return hostnameForLogo(input.careersUrl);
}

export function companyLogoUrls(domain: string): { primary: string; fallback: string } {
  return {
    primary: `https://logo.clearbit.com/${domain}`,
    fallback: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  };
}
