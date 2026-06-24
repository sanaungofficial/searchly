import Anthropic from "@anthropic-ai/sdk";
import type { CompanyIntel, TrackedCompany } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectiveCareersUrl, getIntelCareersUrl } from "@/lib/company-intel";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  getCompanyScanSettings,
  isIntelScanStale,
  type CompanyScanCronSummary,
  type CompanyScanSettings,
  type JobsScanProvider,
  recordCompanyScanCronRun,
} from "@/lib/company-scan-config";
import { fetchHirebaseCompanyJobs, fetchHirebaseMatchingJobs, isHirebaseConfigured } from "@/lib/hirebase";
import { getHirebaseMetaFromEnrichment } from "@/lib/hirebase-company-sync";
import {
  buildMatchRoles,
  dedupeJobs,
  hasMatchRoles,
  isJobMatch,
} from "@/lib/job-match";

export type CachedJob = {
  title: string;
  location: string | null;
  department: string | null;
  url: string | null;
};

export type JobsCacheSource = "hirebase" | "ai_scrape";

export type JobsCachePayload = {
  jobs: CachedJob[];
  scanned_url: string;
  source?: JobsCacheSource;
  hirebase_slug?: string | null;
  total_count?: number;
  match_only?: boolean;
};

export const MATCH_SCAN_MAX_JOBS = 50;

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export function parseJobsCache(raw: unknown): JobsCachePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { jobs?: unknown; scanned_url?: unknown };
  if (!Array.isArray(obj.jobs)) return null;
  const extended = raw as JobsCachePayload;
  return {
    jobs: obj.jobs as CachedJob[],
    scanned_url: typeof obj.scanned_url === "string" ? obj.scanned_url : "",
    source: extended.source,
    hirebase_slug: extended.hirebase_slug ?? null,
    total_count: extended.total_count,
    match_only: extended.match_only,
  };
}

export function canScanCompanyIntel(intel: Pick<CompanyIntel, "name" | "careersUrl" | "website">): boolean {
  if (getIntelCareersUrl(intel)) return true;
  if (isHirebaseConfigured() && intel.name?.trim()) return true;
  return false;
}

function resolveJobsScanProvider(settings: CompanyScanSettings): JobsScanProvider {
  if (!isHirebaseConfigured()) return "ai";
  if (settings.jobsScanProvider === "ai") return "ai";
  return settings.jobsScanProvider;
}

function capMatchJobs(settings: CompanyScanSettings): number {
  return Math.max(1, Math.min(MATCH_SCAN_MAX_JOBS, settings.hirebaseMaxJobsPerCompany || MATCH_SCAN_MAX_JOBS));
}

function filterToMatches(jobs: CachedJob[], matchRoles: string[], maxJobs: number): CachedJob[] {
  return dedupeJobs(jobs.filter((job) => isJobMatch(job.title, matchRoles))).slice(0, maxJobs);
}

export function canScanTrackedCompanyMatches(input: {
  profileTargetRoles: string[];
  companyTargetRoles: string | null;
  name: string;
  careersUrl: string | null;
  website: string | null;
}): boolean {
  if (!hasMatchRoles(input.profileTargetRoles, input.companyTargetRoles)) return false;
  if (isHirebaseConfigured() && input.name?.trim()) return true;
  return !!getEffectiveCareersUrl(
    { careersUrl: input.careersUrl, website: input.website } as TrackedCompany,
    null
  );
}

export async function trackedCompanyNeedsScan(trackedCompanyId: string, userId: string): Promise<boolean> {
  const settings = await getCompanyScanSettings();
  if (!settings.autoScanOnAdd) return false;

  const company = await prisma.trackedCompany.findFirst({
    where: { id: trackedCompanyId, userId },
    include: { user: { include: { profile: true } } },
  });
  if (!company) return false;

  const profileRoles = company.user.profile?.targetRoles ?? [];
  if (!canScanTrackedCompanyMatches({
    profileTargetRoles: profileRoles,
    companyTargetRoles: company.targetRoles,
    name: company.name,
    careersUrl: company.careersUrl,
    website: company.website,
  })) {
    return false;
  }

  return isIntelScanStale(company.lastJobsFetchedAt, settings.refreshIntervalDays);
}

/** @deprecated Use trackedCompanyNeedsScan — shared intel no longer stores jobs until a user tracks. */
export async function intelNeedsScan(intel: CompanyIntel): Promise<boolean> {
  return false;
}

async function scanMatchesViaHirebase(
  companyName: string,
  slugHint: string | null,
  website: string | null,
  enrichmentCache: unknown,
  matchRoles: string[],
  settings: CompanyScanSettings
): Promise<{ ok: true; parsed: JobsCachePayload } | { ok: false; error: string }> {
  try {
    const hirebaseMeta = getHirebaseMetaFromEnrichment(enrichmentCache);
    const maxJobs = capMatchJobs(settings);
    const result = await fetchHirebaseMatchingJobs({
      companyName,
      slugHint,
      hirebaseSlug: hirebaseMeta?.slug ?? slugHint,
      website,
      jobTitles: matchRoles,
      maxJobs,
    });

    const matched = filterToMatches(result.jobs, matchRoles, maxJobs);

    return {
      ok: true,
      parsed: {
        jobs: matched,
        scanned_url: result.scannedUrl,
        source: "hirebase",
        hirebase_slug: result.hirebaseSlug,
        total_count: result.totalCount,
        match_only: true,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Hirebase request failed.";
    return { ok: false, error: msg };
  }
}

async function scanMatchesViaAi(
  intel: CompanyIntel | null,
  tracked: TrackedCompany,
  matchRoles: string[],
  settings: CompanyScanSettings
): Promise<{ ok: true; parsed: JobsCachePayload } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "AI not configured" };
  }

  const careersUrl = getEffectiveCareersUrl(tracked, intel);
  if (!careersUrl) {
    return { ok: false, error: "No careers URL configured for this company." };
  }

  let pageText = "";
  try {
    const res = await fetch(careersUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return { ok: false, error: `Careers page returned ${res.status}. Try a direct ATS URL.` };
    }

    const html = await res.text();
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("timeout") || msg.includes("abort")) {
      return { ok: false, error: "Careers page took too long to load." };
    }
    return { ok: false, error: "Could not fetch careers page. The site may block bots." };
  }

  if (!pageText || pageText.length < 50) {
    return { ok: false, error: "Careers page content was empty — may require JavaScript or login." };
  }

  const template = await getPrompt("COMPANY_JOBS_SCAN");
  const prompt = interpolate(template, { careersUrl, pageText });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const raw = JSON.parse(jsonMatch[0]) as JobsCachePayload;
    if (!Array.isArray(raw.jobs)) raw.jobs = [];
    const maxJobs = capMatchJobs(settings);
    const matched = filterToMatches(raw.jobs, matchRoles, maxJobs);
    return {
      ok: true,
      parsed: {
        jobs: matched,
        scanned_url: raw.scanned_url ?? careersUrl,
        source: "ai_scrape",
        total_count: matched.length,
        match_only: true,
      },
    };
  } catch {
    return { ok: false, error: "Could not parse jobs from the page." };
  }
}

/** Lazy match-only scan for a user's tracked company — stores jobs on TrackedCompany only. */
export async function scanTrackedCompanyMatches(
  trackedCompanyId: string,
  userId: string
): Promise<{ ok: true; company: TrackedCompany; jobCount: number } | { ok: false; error: string }> {
  const company = await prisma.trackedCompany.findFirst({
    where: { id: trackedCompanyId, userId },
    include: { companyIntel: true, user: { include: { profile: true } } },
  });
  if (!company) return { ok: false, error: "Company not found" };

  const profileRoles = company.user.profile?.targetRoles ?? [];
  const matchRoles = buildMatchRoles(profileRoles, company.targetRoles);
  if (!matchRoles.length) {
    return {
      ok: false,
      error: "Add target roles in Profile → Target Roles (or below) before scanning for matching jobs.",
    };
  }

  const settings = await getCompanyScanSettings();
  const provider = resolveJobsScanProvider(settings);
  const intel = company.companyIntel;
  const slugHint = intel?.slug ?? null;
  const enrichmentCache = intel?.enrichmentCache ?? company.enrichmentCache;

  let parsed: JobsCachePayload | null = null;
  let lastError: string | null = null;

  if (provider === "hirebase" || provider === "hirebase_then_ai") {
    const hirebaseResult = await scanMatchesViaHirebase(
      intel?.name ?? company.name,
      slugHint,
      company.website ?? intel?.website ?? null,
      enrichmentCache,
      matchRoles,
      settings
    );
    if (hirebaseResult.ok) {
      parsed = hirebaseResult.parsed;
    } else {
      lastError = hirebaseResult.error;
      if (provider === "hirebase") {
        return { ok: false, error: hirebaseResult.error };
      }
    }
  }

  if (!parsed && (provider === "ai" || provider === "hirebase_then_ai")) {
    const aiResult = await scanMatchesViaAi(intel, company, matchRoles, settings);
    if (aiResult.ok) {
      parsed = aiResult.parsed;
    } else {
      return { ok: false, error: lastError ? `${lastError} · ${aiResult.error}` : aiResult.error };
    }
  }

  if (!parsed) {
    return { ok: false, error: lastError ?? "No jobs scan provider available." };
  }

  const updated = await prisma.trackedCompany.update({
    where: { id: trackedCompanyId },
    data: {
      jobsCache: parsed,
      lastJobsFetchedAt: new Date(),
    },
  });

  return { ok: true, company: updated, jobCount: parsed.jobs.length };
}

async function scanCompanyIntelViaHirebase(
  intel: CompanyIntel,
  settings: CompanyScanSettings
): Promise<{ ok: true; parsed: JobsCachePayload } | { ok: false; error: string }> {
  try {
    const result = await fetchHirebaseCompanyJobs({
      companyName: intel.name,
      slugHint: intel.slug,
      website: intel.website,
      maxJobs: settings.hirebaseMaxJobsPerCompany,
    });

    return {
      ok: true,
      parsed: {
        jobs: result.jobs,
        scanned_url: result.scannedUrl,
        source: "hirebase",
        hirebase_slug: result.hirebaseSlug,
        total_count: result.totalCount,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Hirebase request failed.";
    return { ok: false, error: msg };
  }
}

async function scanCompanyIntelViaAi(
  intel: CompanyIntel
): Promise<{ ok: true; parsed: JobsCachePayload } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "AI not configured" };
  }

  const careersUrl = getIntelCareersUrl(intel);
  if (!careersUrl) {
    return { ok: false, error: "No careers URL configured for this company." };
  }

  let pageText = "";
  try {
    const res = await fetch(careersUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return { ok: false, error: `Careers page returned ${res.status}. Try a direct ATS URL.` };
    }

    const html = await res.text();
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("timeout") || msg.includes("abort")) {
      return { ok: false, error: "Careers page took too long to load." };
    }
    return { ok: false, error: "Could not fetch careers page. The site may block bots." };
  }

  if (!pageText || pageText.length < 50) {
    return { ok: false, error: "Careers page content was empty — may require JavaScript or login." };
  }

  const template = await getPrompt("COMPANY_JOBS_SCAN");
  const prompt = interpolate(template, { careersUrl, pageText });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const raw = JSON.parse(jsonMatch[0]) as JobsCachePayload;
    if (!Array.isArray(raw.jobs)) raw.jobs = [];
    return {
      ok: true,
      parsed: {
        jobs: raw.jobs,
        scanned_url: raw.scanned_url ?? careersUrl,
        source: "ai_scrape",
        total_count: raw.jobs.length,
      },
    };
  } catch {
    return { ok: false, error: "Could not parse jobs from the page." };
  }
}

/** Admin / legacy full-company scan — writes to shared CompanyIntel. */
export async function scanCompanyIntel(
  intelId: string
): Promise<{ ok: true; intel: CompanyIntel; jobCount: number } | { ok: false; error: string }> {
  const intel = await prisma.companyIntel.findUnique({ where: { id: intelId } });
  if (!intel) return { ok: false, error: "Company intel not found" };

  const settings = await getCompanyScanSettings();
  const provider = resolveJobsScanProvider(settings);

  let parsed: JobsCachePayload | null = null;
  let lastError: string | null = null;

  if (provider === "hirebase" || provider === "hirebase_then_ai") {
    const hirebaseResult = await scanCompanyIntelViaHirebase(intel, settings);
    if (hirebaseResult.ok) {
      parsed = hirebaseResult.parsed;
    } else {
      lastError = hirebaseResult.error;
      if (provider === "hirebase") {
        return { ok: false, error: hirebaseResult.error };
      }
    }
  }

  if (!parsed && (provider === "ai" || provider === "hirebase_then_ai")) {
    const aiResult = await scanCompanyIntelViaAi(intel);
    if (aiResult.ok) {
      parsed = aiResult.parsed;
    } else {
      return { ok: false, error: lastError ? `${lastError} · ${aiResult.error}` : aiResult.error };
    }
  }

  if (!parsed) {
    return { ok: false, error: lastError ?? "No jobs scan provider available." };
  }

  const updated = await prisma.companyIntel.update({
    where: { id: intelId },
    data: {
      jobsCache: parsed,
      lastJobsFetchedAt: new Date(),
      careersUrl: intel.careersUrl ?? getIntelCareersUrl(intel),
    },
  });

  return { ok: true, intel: updated, jobCount: parsed.jobs.length };
}

export async function runCompanyJobsCron(): Promise<CompanyScanCronSummary> {
  const settings = await getCompanyScanSettings();
  const summary: CompanyScanCronSummary = { scanned: 0, skipped: 0, failed: 0, errors: [] };

  if (!settings.cronEnabled) {
    await recordCompanyScanCronRun(summary);
    return summary;
  }

  const provider = resolveJobsScanProvider(settings);
  if (provider === "ai" && !process.env.ANTHROPIC_API_KEY) {
    summary.errors.push("ANTHROPIC_API_KEY not configured");
    summary.failed += 1;
    await recordCompanyScanCronRun(summary);
    return summary;
  }

  if ((provider === "hirebase" || provider === "hirebase_then_ai") && !isHirebaseConfigured()) {
    summary.errors.push("HIREBASE_API_KEY not configured");
    summary.failed += 1;
    await recordCompanyScanCronRun(summary);
    return summary;
  }

  const staleCutoff = new Date(Date.now() - settings.refreshIntervalDays * 24 * 60 * 60 * 1000);

  const trackedRows = await prisma.trackedCompany.findMany({
    where: {
      OR: [{ lastJobsFetchedAt: null }, { lastJobsFetchedAt: { lt: staleCutoff } }],
    },
    include: { user: { include: { profile: true } } },
    orderBy: { lastJobsFetchedAt: "asc" },
    take: settings.maxCompaniesPerCronRun * 3,
  });

  let processed = 0;
  for (const row of trackedRows) {
    if (processed >= settings.maxCompaniesPerCronRun) break;

    const profileRoles = row.user.profile?.targetRoles ?? [];
    if (
      !canScanTrackedCompanyMatches({
        profileTargetRoles: profileRoles,
        companyTargetRoles: row.targetRoles,
        name: row.name,
        careersUrl: row.careersUrl,
        website: row.website,
      })
    ) {
      summary.skipped += 1;
      continue;
    }

    processed += 1;
    const result = await scanTrackedCompanyMatches(row.id, row.userId);
    if (result.ok) {
      summary.scanned += 1;
    } else {
      summary.failed += 1;
      summary.errors.push(`${row.name}: ${result.error}`);
    }
  }

  await recordCompanyScanCronRun(summary);
  return summary;
}
