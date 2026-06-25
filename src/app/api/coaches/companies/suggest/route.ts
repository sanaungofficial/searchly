import { CoachStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { normalizeCompanySlug } from "@/lib/company-catalog";
import { collectCoachCompanyRecords, type CoachCompanyRecord } from "@/lib/coach-companies";
import { hirebaseToSuggestItem, type CompanySuggestItem } from "@/lib/company-intel";
import { isHirebaseConfigured, searchHirebaseCompanies } from "@/lib/hirebase";
import { prisma } from "@/lib/prisma";

function recordToSuggestItem(record: CoachCompanyRecord): CompanySuggestItem {
  return {
    id: null,
    catalogSlug: record.slug,
    name: record.name,
    website: null,
    careersUrl: null,
    logoUrl: null,
    type: null,
    source: "intel",
  };
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
    return NextResponse.json(coachCompanies.slice(0, limit).map(recordToSuggestItem));
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
    push(recordToSuggestItem(record));
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
