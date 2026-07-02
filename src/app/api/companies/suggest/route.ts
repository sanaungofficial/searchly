import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { searchCatalog, normalizeCompanySlug } from "@/lib/company-catalog";
import {
  catalogToSuggestItem,
  hirebaseToSuggestItem,
  trackedToSuggestItem,
  type CompanySuggestItem,
} from "@/lib/company-intel";
import { ensureDbUser } from "@/lib/ensure-db-user";
import { isHirebaseConfigured, searchHirebaseCompanies } from "@/lib/hirebase";

export async function GET(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 8), 12);

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  const results: CompanySuggestItem[] = [];
  const seen = new Set<string>();

  const push = (item: CompanySuggestItem) => {
    const key = item.catalogSlug.toLowerCase();
    if (seen.has(key) || results.length >= limit) return;
    seen.add(key);
    results.push(item);
  };

  if (isHirebaseConfigured()) {
    try {
      const hirebaseMatches = await searchHirebaseCompanies(q, limit);
      for (const company of hirebaseMatches) {
        push(hirebaseToSuggestItem(company));
      }
      if (results.length >= limit) {
        return NextResponse.json(results);
      }
    } catch (err) {
      console.error("[companies/suggest hirebase]", err);
    }
  }

  const catalogMatches = searchCatalog(q, limit);
  const catalogSlugs = new Set(catalogMatches.map((c) => c.slug));

  let dbMatches: Awaited<ReturnType<typeof prisma.companyIntel.findMany>> = [];
  dbMatches = await prisma.companyIntel.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: normalizeCompanySlug(q), mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  for (const company of catalogMatches) {
    const intel = dbMatches.find((row) => row.slug === company.slug);
    push(catalogToSuggestItem(company, intel?.id));
  }

  for (const intel of dbMatches) {
    if (catalogSlugs.has(intel.slug)) continue;
    push({
      id: intel.id,
      catalogSlug: intel.slug,
      name: intel.name,
      website: intel.website,
      careersUrl: intel.careersUrl,
      logoUrl: null,
      type: null,
      source: "intel",
    });
  }

  if (results.length < limit) {
    const trackedMatches = await prisma.trackedCompany.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: {
        name: true,
        website: true,
        careersUrl: true,
        companyIntel: { select: { slug: true, website: true, careersUrl: true } },
      },
      orderBy: { name: "asc" },
      take: limit * 2,
    });

    for (const tracked of trackedMatches) {
      push(trackedToSuggestItem(tracked));
      if (results.length >= limit) break;
    }
  }

  return NextResponse.json(results.slice(0, limit));
}
