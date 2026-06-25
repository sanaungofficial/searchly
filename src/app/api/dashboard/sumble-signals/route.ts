import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getDashboardSumbleSignalsBundle } from "@/lib/sumble-intel-service";

/** Aggregated Sumble signals from the user's tracked companies for dashboard. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  const allowFetch = new URL(request.url).searchParams.get("load") === "1" || forceRefresh;

  const bundle = await getDashboardSumbleSignalsBundle({
    userId: dbUser.id,
    forceRefresh,
    allowFetch,
  });

  if (bundle.error && !bundle.signals.length && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
