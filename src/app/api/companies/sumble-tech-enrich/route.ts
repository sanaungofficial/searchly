import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getOrganizationTechEnrichBundle } from "@/lib/sumble-tech-stack-service";

/** Which of the user's technologies a company uses. Requires load=1. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const organizationId = Number(searchParams.get("organizationId") ?? "");
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = searchParams.get("load") === "1" || forceRefresh;

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return NextResponse.json({ error: "organizationId is required." }, { status: 400 });
  }

  const bundle = await getOrganizationTechEnrichBundle({
    userId: dbUser.id,
    organizationId,
    allowFetch,
    forceRefresh,
  });

  if (bundle.error && !bundle.technologies.length && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
