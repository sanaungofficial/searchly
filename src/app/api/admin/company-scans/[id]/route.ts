import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIntelCareersUrl } from "@/lib/company-intel";
import { getCatalogCompany, TOP_50_CATALOG } from "@/lib/company-catalog";
import {
  getCompanyScanSettings,
  isIntelScanStale,
} from "@/lib/company-scan-config";
import { canScanCompanyIntel, parseJobsCache, scanCompanyIntel } from "@/lib/company-jobs-scan";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { getHirebaseMetaFromEnrichment } from "@/lib/hirebase-company-sync";

type RouteContext = { params: Promise<{ id: string }> };

function serializeIntel(intel: NonNullable<Awaited<ReturnType<typeof loadIntel>>>, settings: Awaited<ReturnType<typeof getCompanyScanSettings>>) {
  const cache = parseJobsCache(intel.jobsCache);
  const careersUrl = getIntelCareersUrl(intel);
  const catalog = getCatalogCompany(intel.slug);
  const website = intel.website ?? catalog?.website ?? null;
  const hirebase = getHirebaseMetaFromEnrichment(intel.enrichmentCache);

  return {
    id: intel.id,
    name: intel.name,
    slug: intel.slug,
    website,
    careersUrl,
    catalogType: catalog?.type ?? null,
    watchlistCount: intel._count.trackedCompanies,
    enrichmentCache: intel.enrichmentCache,
    enrichmentFetchedAt: intel.enrichmentFetchedAt?.toISOString() ?? null,
    jobsCache: cache,
    lastJobsFetchedAt: intel.lastJobsFetchedAt?.toISOString() ?? null,
    jobCount: cache?.jobs.length ?? 0,
    jobsSource: cache?.source ?? null,
    hirebaseSlug: cache?.hirebase_slug ?? hirebase?.slug ?? null,
    hirebaseJobBoard: hirebase?.jobBoard ?? null,
    hirebaseOpenJobs: hirebase?.totalOpenJobs ?? null,
    hirebaseLinkedIn: hirebase?.linkedinLink ?? null,
    hirebaseLogo: hirebase?.logo ?? null,
    hirebaseSubindustries: hirebase?.subindustries ?? [],
    hirebaseSyncedAt: hirebase?.syncedAt ?? null,
    hirebaseProfileAt: hirebase ? intel.enrichmentFetchedAt?.toISOString() ?? null : null,
    stale: isIntelScanStale(intel.lastJobsFetchedAt, settings.refreshIntervalDays),
    scannable: canScanCompanyIntel(intel),
    inTop50Catalog: TOP_50_CATALOG.some((c) => c.slug === intel.slug),
  };
}

async function loadIntel(id: string) {
  return prisma.companyIntel.findUnique({
    where: { id },
    include: { _count: { select: { trackedCompanies: true } } },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const intel = await loadIntel(id);
  if (!intel) {
    return NextResponse.json({ error: "Company intel not found" }, { status: 404 });
  }

  const settings = await getCompanyScanSettings();
  return NextResponse.json({
    company: serializeIntel(intel, settings),
    hirebaseConfigured: isHirebaseConfigured(),
  });
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const intel = await loadIntel(id);
  if (!intel) {
    return NextResponse.json({ error: "Company intel not found" }, { status: 404 });
  }

  const result = await scanCompanyIntel(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  const settings = await getCompanyScanSettings();
  return NextResponse.json({
    company: serializeIntel(
      { ...result.intel, _count: intel._count },
      settings
    ),
  });
}
