import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";
import { hostnameFromUrl } from "@/lib/company-domain";
import { mergeTrackedWithIntel, syncTrackedFromIntel } from "@/lib/company-intel";
import {
  canAccessSumbleBriefs,
  getSumbleBriefAccess,
  isSumbleConfigured,
} from "@/lib/sumble-access";
import {
  getSumbleBriefFromEnrichment,
  mergeSumbleBriefIntoEnrichment,
  type SumbleBriefCache,
} from "@/lib/sumble-brief-cache";
import { fetchSumbleIntelligenceBrief, fetchSumbleOrganizationMatch } from "@/lib/sumble";

function enrichmentWebsiteFromCache(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const url = (raw as { websiteUrl?: string | null }).websiteUrl;
  return url?.trim() || null;
}

function resolveWebsite(company: {
  website: string | null;
  enrichmentCache: unknown;
}): string | null {
  return company.website?.trim() || enrichmentWebsiteFromCache(company.enrichmentCache) || null;
}

async function loadCompany(userId: string, id: string) {
  return prisma.trackedCompany.findFirst({
    where: { id, userId },
    include: { companyIntel: true },
  });
}

async function persistBrief(
  company: NonNullable<Awaited<ReturnType<typeof loadCompany>>>,
  brief: SumbleBriefCache,
) {
  const mergedCache = mergeSumbleBriefIntoEnrichment(company.enrichmentCache, brief);
  const now = new Date();

  if (company.companyIntelId && company.companyIntel) {
    const intel = await prisma.companyIntel.update({
      where: { id: company.companyIntelId },
      data: {
        enrichmentCache: mergedCache,
        enrichmentFetchedAt: company.enrichmentFetchedAt ?? now,
      },
    });
    const synced = await syncTrackedFromIntel(company.id, intel);
    return mergeTrackedWithIntel(synced, intel);
  }

  return prisma.trackedCompany.update({
    where: { id: company.id },
    data: {
      enrichmentCache: mergedCache,
      enrichmentFetchedAt: company.enrichmentFetchedAt ?? now,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { dbUser, realDbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = getSumbleBriefAccess(dbUser, realDbUser);
  const { id } = await params;
  const company = await loadCompany(dbUser.id, id);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const brief = getSumbleBriefFromEnrichment(company.enrichmentCache);

  return NextResponse.json({
    access,
    brief,
    companyName: company.companyIntel?.name ?? company.name,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { dbUser, realDbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canAccessSumbleBriefs(dbUser, realDbUser)) {
    return NextResponse.json(
      { error: "Intelligence briefs are available on enterprise coaching plans.", code: "SUMBLE_BRIEF_LOCKED" },
      { status: 403 },
    );
  }

  if (!isSumbleConfigured()) {
    return NextResponse.json({ error: "Intelligence briefs are not configured on this environment." }, { status: 503 });
  }

  const { id } = await params;
  const company = await loadCompany(dbUser.id, id);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const existing = getSumbleBriefFromEnrichment(company.enrichmentCache);
  if (existing && !forceRefresh) {
    return NextResponse.json({
      brief: existing,
      company: await mergeTrackedWithIntel(company, company.companyIntel),
      cached: true,
    });
  }

  const displayName = company.companyIntel?.name ?? company.name;
  const website = resolveWebsite(company);
  const domain = hostnameFromUrl(website) ?? website;

  try {
    let organizationId = existing?.organizationId ?? null;
    let organizationSlug = existing?.organizationSlug ?? null;
    let organizationName = existing?.organizationName ?? displayName;

    if (!organizationId || forceRefresh) {
      const matched = await fetchSumbleOrganizationMatch({ name: displayName, domain });
      if (!matched.organizationId) {
        return NextResponse.json(
          { error: `Could not find "${displayName}" in our company intelligence database.` },
          { status: 404 },
        );
      }
      organizationId = matched.organizationId;
      organizationSlug = String(matched.organizationId);
      organizationName = matched.organizationName ?? displayName;
    }

    const briefResult = await fetchSumbleIntelligenceBrief(organizationId);
    if (briefResult.pending || !briefResult.brief) {
      return NextResponse.json(
        { error: briefResult.message ?? "Intelligence brief is still being prepared. Try again in a minute." },
        { status: 202 },
      );
    }

    const b = briefResult.brief;
    const brief: SumbleBriefCache = {
      organizationId: b.organization_id,
      organizationSlug: b.organization_slug || organizationSlug,
      organizationName,
      briefId: `${b.organization_id}-${b.organization_slug}`,
      title: b.title,
      body: b.body,
      sumbleUrl: b.sumble_url,
      fetchedAt: new Date().toISOString(),
    };

    const updated = await persistBrief(company, brief);
    const merged = company.companyIntel
      ? mergeTrackedWithIntel(updated, company.companyIntel)
      : updated;

    return NextResponse.json({ brief, company: merged, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate intelligence brief.";
    const status = message.includes("Not enough company data") ? 422 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
