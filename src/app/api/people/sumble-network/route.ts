import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getPersonNetworkExpandBundle } from "@/lib/sumble-job-contacts-service";

/** Expand one contact to inferred managers and peers (direct reports). Requires load=1. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const personId = Number(searchParams.get("personId") ?? "");
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = searchParams.get("load") === "1" || forceRefresh;

  if (!Number.isFinite(personId) || personId <= 0) {
    return NextResponse.json({ error: "personId is required." }, { status: 400 });
  }

  const bundle = await getPersonNetworkExpandBundle({
    personId,
    allowFetch,
    forceRefresh,
  });

  if (bundle.error && !bundle.managers.length && !bundle.peers.length && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}

export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { personId?: number; load?: boolean } = {};
  try {
    body = (await request.json()) as { personId?: number; load?: boolean };
  } catch {
    // optional body
  }

  const { searchParams } = new URL(request.url);
  const personId = Number(body.personId ?? searchParams.get("personId") ?? "");
  const allowFetch = body.load === true || searchParams.get("load") === "1";

  if (!Number.isFinite(personId) || personId <= 0) {
    return NextResponse.json({ error: "personId is required." }, { status: 400 });
  }

  const bundle = await getPersonNetworkExpandBundle({ personId, allowFetch });

  if (bundle.error && !bundle.managers.length && !bundle.peers.length && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
