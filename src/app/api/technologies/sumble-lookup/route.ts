import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getTechLookupBundle } from "@/lib/sumble-tech-stack-service";

/** Resolve profile skills to canonical Sumble technology slugs. Requires load=1. */
export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { load?: boolean } = {};
  try {
    body = (await request.json()) as { load?: boolean };
  } catch {
    // GET-style probe via POST without body
  }

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = body.load === true || searchParams.get("load") === "1" || forceRefresh;

  const bundle = await getTechLookupBundle({
    userId: dbUser.id,
    allowFetch,
    forceRefresh,
  });

  if (bundle.error && !bundle.resolved.length && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}

/** Cache probe — no credits. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = searchParams.get("load") === "1" || forceRefresh;

  const bundle = await getTechLookupBundle({
    userId: dbUser.id,
    allowFetch,
    forceRefresh,
  });

  return NextResponse.json(bundle);
}
