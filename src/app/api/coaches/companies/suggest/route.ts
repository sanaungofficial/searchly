import { CoachStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCatalogCompany, normalizeCompanySlug } from "@/lib/company-catalog";
import { collectCoachCompanyRecords, type CoachCompanyRecord } from "@/lib/coach-companies";
import { catalogToSuggestItem, hirebaseToSuggestItem, type CompanySuggestItem } from "@/lib/company-intel";
import type { CompanyEnrichmentCache } from "@/lib/hirebase-company-sync";
import { isHirebaseConfigured, searchHirebaseCompanies } from "@/lib/hirebase";
import { prisma } from "@/lib/prisma";

function logoFromIntelEnrichment(enrichment: unknown): string | null {
  const cache = enrichment as CompanyEnrichmentCache | null | undefined;
  const logo = cache?.hirebase?.logo?.trim();
  return logo || null;
}

async function recordsToSuggestItems(records: CoachCompanyRecord[]): Promise<CompanySuggestItem[]> {
  if (!records.length) return [];

  const slugs = records.map((r) => r.slug);
  const intelRows = await prisma.companyIntel.findMany({ where: { slug: { in: slugs } } });
  const intelBySlug = new Map(intelRows.map((row) => [row.slug, row]));

  return records.map((record) => {
    const catalog = getCatalogCompany(record.slug);
    const intel = intelBySlug.get(record.slug);
    const logoUrl = logoFromIntelEnrichment(intel?.enrichmentCache);

    if (catalog) {
      const item = catalogToSuggestItem(catalog, intel?.id);
      return { ...item, logoUrl: logoUrl ?? item.logoUrl };
    }

    return {
      id: intel?.id ?? null,
      catalogSlug: record.slug,
      name: record.name,
      website: intel?.website ?? null,
      careersUrl: intel?.careersUrl ?? null,
      logoUrl,
      type: null,
      source: intel ? "intel" : "intel",
    };
  });
}

async function recordToSuggestItem(record: CoachCompanyRecord): Promise<CompanySuggestItem> {
  const [item] = await recordsToSuggestItems([record]);
  return item;
}

function hirebaseMatchesCoachCompany(item: CompanySuggestItem, coachCompanies: CoachCompanyRecord[]): boolean {
  const slug = item.catalogSlug.toLowerCase();
  const nameLower = item.name.toLowerCase();
  return coachCompanies.some(
    (cc) =>
      cc.slug === slug ||
      cc.name.toLowerCase() === nameLower ||
      normalizeCompanySlug(cc.name) === slug,
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 12), 20);

  const coaches = await prisma.coachProfile.findMany({
    where: { status: CoachStatus.ACTIVE },
    select: { firms: true, currentCompany: true },
  });

  const coachCompanies = collectCoachCompanyRecords(coaches);
  if (!coachCompanies.length) return NextResponse.json([]);

  if (!q) {
    const items = await recordsToSuggestItems(coachCompanies.slice(0, limit));
    return NextResponse.json(items);
  }

  const qLower = q.toLowerCase();
  const qSlug = normalizeCompanySlug(q);
  const localMatches = coachCompanies.filter(
    (c) => c.name.toLowerCase().includes(qLower) || (qSlug && c.slug.includes(qSlug)),
  );

  const results: CompanySuggestItem[] = [];
  const seen = new Set<string>();

  const push = (item: CompanySuggestItem) => {
    const key = item.catalogSlug.toLowerCase();
    if (seen.has(key) || results.length >= limit) return;
    seen.add(key);
    results.push(item);
  };

  for (const record of localMatches) {
    push(await recordToSuggestItem(record));
  }

  if (q.length >= 2 && isHirebaseConfigured()) {
    try {
      const hirebaseMatches = await searchHirebaseCompanies(q, limit);
      for (const company of hirebaseMatches) {
        const item = hirebaseToSuggestItem(company);
        if (hirebaseMatchesCoachCompany(item, coachCompanies)) {
          push(item);
        }
      }
    } catch (err) {
      console.error("[coaches/companies/suggest hirebase]", err);
    }
  }

  return NextResponse.json(results.slice(0, limit));
}
