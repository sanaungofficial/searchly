import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getMarketSignalsBundle } from "@/lib/sumble-market-extended";

export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = searchParams.get("load") === "1" || forceRefresh;

  const bundle = await getMarketSignalsBundle({
    userId: dbUser.id,
    allowFetch,
    forceRefresh,
  });

  if (bundle.error && !bundle.signals.length && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
