import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import {
  getMarketInsightsBundle,
  MARKET_WINDOW_OPTIONS,
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

/** Personalized market insights — multi-window for zoom in/out. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const primaryDays = parseDays(searchParams.get("days"), 30);
  const compareWindows = parseWindows(searchParams);
  const forceRefresh = searchParams.get("refresh") === "1";

  const bundle = await getMarketInsightsBundle({
    userId: dbUser.id,
    primaryDays,
    compareWindows,
    forceRefresh,
  });

  if (bundle.error && !Object.keys(bundle.windows).length) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
