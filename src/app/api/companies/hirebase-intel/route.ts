import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";
import {
  getCompanyIntelBundle,
  MARKET_WINDOW_OPTIONS,
  slugFromEnrichment,
  type MarketWindow,
} from "@/lib/market-insights-service";

function parseDays(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return MARKET_WINDOW_OPTIONS.includes(n as MarketWindow) ? n : fallback;
}

function parseWindows(searchParams: URLSearchParams): number[] {
  const raw = searchParams.get("windows");
  if (!raw) return [7, 30, 90];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => MARKET_WINDOW_OPTIONS.includes(n as MarketWindow));
}

/** Hirebase company insights for watchlist drawer and market drill-down. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const trackedId = searchParams.get("trackedId");
  const slugParam = searchParams.get("slug");
  const nameParam = searchParams.get("name");
  const primaryDays = parseDays(searchParams.get("days"), 30);
  const compareWindows = parseWindows(searchParams);
  const forceRefresh = searchParams.get("refresh") === "1";

  let companyName = nameParam?.trim() || "";
  let slugHint = slugParam?.trim() || null;
  let website: string | null = null;

  if (trackedId) {
    const tracked = await prisma.trackedCompany.findFirst({
      where: { id: trackedId, userId: dbUser.id },
      include: { companyIntel: true },
    });
    if (!tracked) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }
    companyName = tracked.companyIntel?.name ?? tracked.name;
    website = tracked.website ?? tracked.companyIntel?.website ?? null;
    slugHint =
      slugHint ??
      slugFromEnrichment(tracked.companyIntel?.enrichmentCache) ??
      slugFromEnrichment(tracked.enrichmentCache);
  }

  if (!companyName) {
    return NextResponse.json({ error: "Provide trackedId or name." }, { status: 400 });
  }

  const bundle = await getCompanyIntelBundle({
    userId: dbUser.id,
    companyName,
    slugHint,
    website,
    primaryDays,
    compareWindows,
    forceRefresh,
  });

  if (bundle.error && !Object.keys(bundle.windows).length) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
