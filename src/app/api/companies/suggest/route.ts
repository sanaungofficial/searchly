import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { searchCatalog, normalizeCompanySlug } from "@/lib/company-catalog";
import { catalogToSuggestItem } from "@/lib/company-intel";
import { ensureDbUser } from "@/lib/ensure-db-user";

export async function GET(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 8), 12);

  const catalogMatches = searchCatalog(q, limit);
  const catalogSlugs = new Set(catalogMatches.map((c) => c.slug));

  let dbMatches: Awaited<ReturnType<typeof prisma.companyIntel.findMany>> = [];
  if (q.length >= 2) {
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
  }

  const results = [];
  const seen = new Set<string>();

  for (const company of catalogMatches) {
    const intel = dbMatches.find((row) => row.slug === company.slug);
    seen.add(company.slug);
    results.push(catalogToSuggestItem(company, intel?.id));
  }

  for (const intel of dbMatches) {
    if (seen.has(intel.slug) || results.length >= limit) continue;
    seen.add(intel.slug);
    results.push({
      id: intel.id,
      catalogSlug: intel.slug,
      name: intel.name,
      website: intel.website,
      careersUrl: intel.careersUrl,
      type: null,
      source: "intel" as const,
    });
  }

  return NextResponse.json(results.slice(0, limit));
}
