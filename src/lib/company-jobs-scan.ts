import Anthropic from "@anthropic-ai/sdk";
import type { CompanyIntel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getIntelCareersUrl } from "@/lib/company-intel";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  getCompanyScanSettings,
  isIntelScanStale,
  type CompanyScanCronSummary,
  type CompanyScanSettings,
  type JobsScanProvider,
  recordCompanyScanCronRun,
} from "@/lib/company-scan-config";
import { fetchHirebaseCompanyJobs, isHirebaseConfigured } from "@/lib/hirebase";

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
};

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

export async function intelNeedsScan(intel: CompanyIntel): Promise<boolean> {
  const settings = await getCompanyScanSettings();
  if (!settings.autoScanOnAdd) return false;
  if (!canScanCompanyIntel(intel)) return false;
  return isIntelScanStale(intel.lastJobsFetchedAt, settings.refreshIntervalDays);
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

  const intels = await prisma.companyIntel.findMany({
    orderBy: { lastJobsFetchedAt: "asc" },
    take: settings.maxCompaniesPerCronRun * 3,
  });

  let processed = 0;
  for (const intel of intels) {
    if (processed >= settings.maxCompaniesPerCronRun) break;

    if (!canScanCompanyIntel(intel)) {
      summary.skipped += 1;
      continue;
    }

    if (!isIntelScanStale(intel.lastJobsFetchedAt, settings.refreshIntervalDays)) {
      summary.skipped += 1;
      continue;
    }

    processed += 1;
    const result = await scanCompanyIntel(intel.id);
    if (result.ok) {
      summary.scanned += 1;
    } else {
      summary.failed += 1;
      summary.errors.push(`${intel.name}: ${result.error}`);
    }
  }

  await recordCompanyScanCronRun(summary);
  return summary;
}
