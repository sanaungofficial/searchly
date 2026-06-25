import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";
import { getCompanySumbleIntelBundle } from "@/lib/sumble-intel-service";

/** Sumble org intelligence — signals, role metrics, and key people for company drawer. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const trackedId = searchParams.get("trackedId");
  const nameParam = searchParams.get("name");
  const domainParam = searchParams.get("domain");
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = searchParams.get("load") === "1" || forceRefresh;
  const includePeople = searchParams.get("people") === "1";
  const includeTeams = searchParams.get("teams") === "1";

  let companyName = nameParam?.trim() || "";
  let website: string | null = domainParam?.trim() || null;
  let careersUrl: string | null = null;

  if (trackedId) {
    const tracked = await prisma.trackedCompany.findFirst({
      where: { id: trackedId, userId: dbUser.id },
      include: { companyIntel: true },
    });
    if (!tracked) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }
    companyName = tracked.companyIntel?.name ?? tracked.name;
    website = website ?? tracked.website ?? tracked.companyIntel?.website ?? null;
    careersUrl = tracked.careersUrl ?? tracked.companyIntel?.careersUrl ?? null;
  }

  if (!companyName && !website) {
    return NextResponse.json({ error: "Provide trackedId, name, or domain." }, { status: 400 });
  }

  const bundle = await getCompanySumbleIntelBundle({
    userId: dbUser.id,
    companyName,
    website,
    careersUrl,
    includePeople,
    includeTeams,
    forceRefresh,
    allowFetch,
  });

  if (bundle.error && !bundle.organization && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
