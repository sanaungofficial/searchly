import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { CompanyIntel, TrackedCompany } from "@prisma/client";
import { ensureDbUser } from "@/lib/ensure-db-user";
import { mergeTrackedWithIntel } from "@/lib/company-intel";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { refreshTrackedCompanyFromHirebase } from "@/lib/hirebase-company-sync";

const BATCH_SIZE = 5;

function parseIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const parsed = ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  return parsed.length > 0 ? parsed : null;
}

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

type RefreshRowResult = {
  id: string;
  ok: boolean;
  error?: string;
  company?: TrackedCompany;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase, request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isHirebaseConfigured()) {
    return NextResponse.json(
      { error: "Hirebase is not configured on this environment." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const ids = parseIds(body);
  if (!ids) return NextResponse.json({ error: "ids array is required" }, { status: 400 });

  try {
    const owned = await prisma.trackedCompany.findMany({
      where: { userId: dbUser.id, id: { in: ids } },
      include: { companyIntel: true },
    });

    if (owned.length === 0) {
      return NextResponse.json({ error: "No matching companies found" }, { status: 404 });
    }

    const ownedById = new Map(owned.map((row) => [row.id, row]));

    const rowResults = await processInBatches(
      ids.filter((id) => ownedById.has(id)),
      BATCH_SIZE,
      async (id): Promise<RefreshRowResult> => {
        const tracked = ownedById.get(id)!;
        const refresh = await refreshTrackedCompanyFromHirebase(tracked, dbUser.id);
        if (!refresh.ok) {
          return { id, ok: false, error: refresh.error };
        }

        const updated = await prisma.trackedCompany.findFirst({
          where: { id, userId: dbUser.id },
        });
        if (!updated) {
          return { id, ok: false, error: "Company not found after refresh." };
        }

        let intel: CompanyIntel | null = tracked.companyIntel ?? null;
        if (updated.companyIntelId) {
          intel = await prisma.companyIntel.findUnique({ where: { id: updated.companyIntelId } });
        }

        return {
          id,
          ok: true,
          company: mergeTrackedWithIntel(updated, intel),
        };
      },
    );

    const updated = rowResults.filter((row) => row.ok).length;
    const failed = rowResults.filter((row) => !row.ok).length;

    return NextResponse.json({
      updated,
      failed,
      total: rowResults.length,
      results: rowResults,
    });
  } catch (err) {
    console.error("[companies bulk refresh POST]", err);
    return NextResponse.json({ error: "Couldn't refresh companies from Hirebase." }, { status: 500 });
  }
}
