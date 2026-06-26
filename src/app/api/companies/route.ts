import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse, after } from "next/server";
import type { CompanyIntel, TrackedCompany } from "@prisma/client";
import { ensureDbUser } from "@/lib/ensure-db-user";
import { mergeTrackedWithIntel, resolveCompanyIntelFromInput } from "@/lib/company-intel";
import { getCatalogCompany, normalizeCompanySlug } from "@/lib/company-catalog";
import { scanTrackedCompanyMatches, trackedCompanyNeedsScan } from "@/lib/company-jobs-scan";
import {
  hydrateIntelFromHirebase,
  normalizeWebsiteUrl,
} from "@/lib/hirebase-company-sync";

async function findExistingWatchlistCompany(
  userId: string,
  input: { intelId?: string | null; catalogSlug?: string | null; name?: string | null }
) {
  const slug =
    input.catalogSlug?.trim() ||
    (input.name?.trim() ? normalizeCompanySlug(input.name) : null);
  const catalog = slug ? getCatalogCompany(slug) : undefined;
  const nameCandidates = [
    input.name?.trim(),
    catalog?.name,
  ].filter(Boolean) as string[];

  const or: Array<Record<string, unknown>> = [];
  if (input.intelId) or.push({ companyIntelId: input.intelId });
  if (slug) or.push({ companyIntel: { slug } });
  for (const candidate of nameCandidates) {
    or.push({ name: { equals: candidate, mode: "insensitive" } });
  }

  if (!or.length) return null;

  return prisma.trackedCompany.findFirst({
    where: { userId, OR: or },
    select: { id: true, name: true, companyIntelId: true },
  });
}

async function loadTrackedCompanies(userId: string): Promise<TrackedCompany[]> {
  return prisma.trackedCompany.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

async function attachIntel(companies: TrackedCompany[]) {
  const intelIds = [
    ...new Set(companies.map((row) => row.companyIntelId).filter(Boolean)),
  ] as string[];

  if (!intelIds.length) return companies;

  let intelRows: CompanyIntel[] = [];
  try {
    intelRows = await prisma.companyIntel.findMany({
      where: { id: { in: intelIds } },
    });
  } catch (err) {
    console.error("[companies GET intel]", err);
    return companies;
  }

  const intelById = new Map(intelRows.map((row) => [row.id, row]));
  return companies.map((row) =>
    mergeTrackedWithIntel(row, row.companyIntelId ? intelById.get(row.companyIntelId) : null)
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase, request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const companies = await loadTrackedCompanies(dbUser.id);
    const merged = await attachIntel(companies);
    return NextResponse.json(merged);
  } catch (err) {
    console.error("[companies GET]", err);
    return NextResponse.json({ error: "Couldn't load companies." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase, request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name,
    catalogSlug,
    website,
    careersUrl,
    notes,
    type,
    hqLocation,
    priority,
    cultureMission,
    candidateEdge,
    targetRoles,
  } = body;

  if (!name?.trim() && !catalogSlug) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const intel = await resolveCompanyIntelFromInput({
      name,
      catalogSlug,
      website,
      careersUrl,
    });

    const existing = await findExistingWatchlistCompany(dbUser.id, {
      intelId: intel?.id,
      catalogSlug,
      name: intel?.name ?? name,
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "Already on your watchlist.",
          existing: { id: existing.id, name: existing.name },
        },
        { status: 409 }
      );
    }

    const catalogEntry = catalogSlug ? getCatalogCompany(catalogSlug) : undefined;

    let hydratedIntel = intel;
    if (intel) {
      hydratedIntel = await hydrateIntelFromHirebase(intel, {
        slugHint: catalogSlug ?? intel.slug,
        website: website ?? intel.website,
        force: true,
      });
    }

    const enrichmentIndustry =
      hydratedIntel?.enrichmentCache &&
      typeof hydratedIntel.enrichmentCache === "object" &&
      !Array.isArray(hydratedIntel.enrichmentCache)
        ? ((hydratedIntel.enrichmentCache as { industry?: string | null }).industry ?? null)
        : null;
    const enrichmentWebsite =
      hydratedIntel?.enrichmentCache &&
      typeof hydratedIntel.enrichmentCache === "object" &&
      !Array.isArray(hydratedIntel.enrichmentCache)
        ? normalizeWebsiteUrl((hydratedIntel.enrichmentCache as { websiteUrl?: string | null }).websiteUrl)
        : null;

    const company = await prisma.trackedCompany.create({
      data: {
        userId: dbUser.id,
        companyIntelId: hydratedIntel?.id ?? null,
        name: hydratedIntel?.name ?? name.trim(),
        website: website ?? hydratedIntel?.website ?? enrichmentWebsite ?? null,
        careersUrl: careersUrl ?? hydratedIntel?.careersUrl ?? null,
        notes: notes ?? null,
        type: type ?? enrichmentIndustry ?? catalogEntry?.type ?? null,
        hqLocation: hqLocation ?? null,
        priority: priority ?? null,
        cultureMission: cultureMission ?? null,
        candidateEdge: candidateEdge ?? null,
        targetRoles: targetRoles ?? null,
        enrichmentCache: hydratedIntel?.enrichmentCache ?? undefined,
        enrichmentFetchedAt: hydratedIntel?.enrichmentFetchedAt ?? null,
      },
    });

    const [merged] = await attachIntel([company]);
    let scanPending = false;

    if (await trackedCompanyNeedsScan(company.id, dbUser.id)) {
      scanPending = true;
      const trackedId = company.id;
      after(async () => {
        await scanTrackedCompanyMatches(trackedId, dbUser.id).catch((err) => {
          console.error("[companies POST scan]", err);
        });
      });
    }

    return NextResponse.json({ ...merged, scanPending }, { status: 201 });
  } catch (err) {
    console.error("[companies POST]", err);
    if (!name?.trim()) {
      return NextResponse.json({ error: "Couldn't add company." }, { status: 500 });
    }

    try {
      const trimmed = name.trim();
      const existing = await findExistingWatchlistCompany(dbUser.id, { name: trimmed });
      if (existing) {
        return NextResponse.json(
          {
            error: "Already on your watchlist.",
            existing: { id: existing.id, name: existing.name },
          },
          { status: 409 }
        );
      }

      const company = await prisma.trackedCompany.create({
        data: {
          userId: dbUser.id,
          name: trimmed,
          website: website ?? null,
          careersUrl: careersUrl ?? null,
          notes: notes ?? null,
          type: type ?? null,
          hqLocation: hqLocation ?? null,
          priority: priority ?? null,
          cultureMission: cultureMission ?? null,
          candidateEdge: candidateEdge ?? null,
          targetRoles: targetRoles ?? null,
        },
      });
      return NextResponse.json(company, { status: 201 });
    } catch (fallbackErr) {
      console.error("[companies POST fallback]", fallbackErr);
      return NextResponse.json({ error: "Couldn't add company." }, { status: 500 });
    }
  }
}
