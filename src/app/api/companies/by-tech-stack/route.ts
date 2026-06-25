import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getCompaniesByTechStackBundle } from "@/lib/sumble-tech-stack-service";

/** Find organizations using the user's resolved technology stack. Requires load=1. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = searchParams.get("load") === "1" || forceRefresh;
  const limitRaw = Number(searchParams.get("limit") ?? "10");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 10;

  const bundle = await getCompaniesByTechStackBundle({
    userId: dbUser.id,
    limit,
    allowFetch,
    forceRefresh,
  });

  if (bundle.error && !bundle.organizations.length && !bundle.requiresLoad && !bundle.requiresLookup) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
