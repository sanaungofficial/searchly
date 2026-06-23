import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureDbUser } from "@/lib/ensure-db-user";
import { mergeTrackedWithIntel, resolveCompanyIntelFromInput } from "@/lib/company-intel";
import { getCatalogCompany } from "@/lib/company-catalog";

export async function GET() {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const companies = await prisma.trackedCompany.findMany({
      where: { userId: dbUser.id },
      include: { companyIntel: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(companies.map((row) => mergeTrackedWithIntel(row, row.companyIntel)));
  } catch (err) {
    console.error("[companies GET]", err);
    try {
      const companies = await prisma.trackedCompany.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(companies);
    } catch (fallbackErr) {
      console.error("[companies GET fallback]", fallbackErr);
      return NextResponse.json({ error: "Couldn't load companies." }, { status: 500 });
    }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name,
    companyIntelId,
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

  if (!name?.trim() && !companyIntelId && !catalogSlug) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const intel = await resolveCompanyIntelFromInput({
      name,
      companyIntelId,
      catalogSlug,
      website,
      careersUrl,
    });

    if (intel) {
      const existing = await prisma.trackedCompany.findFirst({
        where: { userId: dbUser.id, companyIntelId: intel.id },
      });
      if (existing) {
        return NextResponse.json({ error: "Already on your watchlist." }, { status: 409 });
      }
    }

    const catalogEntry = catalogSlug ? getCatalogCompany(catalogSlug) : undefined;

    const company = await prisma.trackedCompany.create({
      data: {
        userId: dbUser.id,
        companyIntelId: intel?.id ?? null,
        name: intel?.name ?? name.trim(),
        website: website ?? intel?.website ?? null,
        careersUrl: careersUrl ?? intel?.careersUrl ?? null,
        notes: notes ?? null,
        type: type ?? catalogEntry?.type ?? null,
        hqLocation: hqLocation ?? null,
        priority: priority ?? null,
        cultureMission: cultureMission ?? null,
        candidateEdge: candidateEdge ?? null,
        targetRoles: targetRoles ?? null,
        jobsCache: intel?.jobsCache ?? undefined,
        lastJobsFetchedAt: intel?.lastJobsFetchedAt ?? null,
        enrichmentCache: intel?.enrichmentCache ?? undefined,
        enrichmentFetchedAt: intel?.enrichmentFetchedAt ?? null,
      },
      include: { companyIntel: true },
    });

    return NextResponse.json(mergeTrackedWithIntel(company, company.companyIntel), { status: 201 });
  } catch (err) {
    console.error("[companies POST]", err);
    if (!name?.trim()) {
      return NextResponse.json({ error: "Couldn't add company." }, { status: 500 });
    }
    try {
      const trimmed = name.trim();
      const existing = await prisma.trackedCompany.findFirst({
        where: {
          userId: dbUser.id,
          name: { equals: trimmed, mode: "insensitive" },
        },
      });
      if (existing) {
        return NextResponse.json({ error: "Already on your watchlist." }, { status: 409 });
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
