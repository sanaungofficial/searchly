import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getDashboardSumbleSignalsBundle } from "@/lib/sumble-intel-service";

/** Aggregated Sumble signals from the user's tracked companies for dashboard. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  const allowFetch = new URL(request.url).searchParams.get("load") === "1" || forceRefresh;
  const maxCompanies = Number(new URL(request.url).searchParams.get("limit") ?? "10");

  const bundle = await getDashboardSumbleSignalsBundle({
    userId: dbUser.id,
    forceRefresh,
    allowFetch,
    maxCompanies: Number.isFinite(maxCompanies) ? maxCompanies : 10,
  });

  const hasData = bundle.signals.length > 0 || bundle.companies.some((c) => c.matched || c.signals.length > 0);

  if (bundle.error && !hasData && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
