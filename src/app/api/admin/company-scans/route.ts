import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCompanyScanSettings,
  patchCompanyScanSettings,
  DEFAULT_COMPANY_SCAN_SETTINGS,
  isIntelScanStale,
} from "@/lib/company-scan-config";
import { getIntelCareersUrl } from "@/lib/company-intel";
import { getCatalogCompany } from "@/lib/company-catalog";
import { parseJobsCache } from "@/lib/company-jobs-scan";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getCompanyScanSettings();
  const intels = await prisma.companyIntel.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { trackedCompanies: true } } },
  });

  const companies = intels.map((intel) => {
    const cache = parseJobsCache(intel.jobsCache);
    const careersUrl = getIntelCareersUrl(intel);
    const catalog = getCatalogCompany(intel.slug);
    const website = intel.website ?? catalog?.website ?? null;
    return {
      id: intel.id,
      name: intel.name,
      slug: intel.slug,
      website,
      careersUrl,
      watchlistCount: intel._count.trackedCompanies,
      jobCount: cache?.jobs.length ?? 0,
      lastScannedAt: intel.lastJobsFetchedAt?.toISOString() ?? null,
      stale: isIntelScanStale(intel.lastJobsFetchedAt, settings.refreshIntervalDays),
      scannable: !!careersUrl,
    };
  });

  return NextResponse.json({
    settings,
    defaults: DEFAULT_COMPANY_SCAN_SETTINGS,
    vercelCronSchedule: "0 6 * * 0 (Sundays 06:00 UTC — edit vercel.json to change)",
    companies,
    totals: {
      intelCount: companies.length,
      scannable: companies.filter((c) => c.scannable).length,
      stale: companies.filter((c) => c.scannable && c.stale).length,
      withJobs: companies.filter((c) => c.jobCount > 0).length,
    },
  });
}

export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const settings = await patchCompanyScanSettings(
    {
      refreshIntervalDays: body.refreshIntervalDays,
      maxCompaniesPerCronRun: body.maxCompaniesPerCronRun,
      autoScanOnAdd: body.autoScanOnAdd,
      cronEnabled: body.cronEnabled,
    },
    admin.email
  );

  return NextResponse.json({ settings });
}
