import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getJobInsiderConnectionsBundle } from "@/lib/sumble-job-contacts-service";

/** Sumble hiring managers + org people for job drawer insider connections. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get("company")?.trim() ?? "";
  const jobTitle = searchParams.get("title")?.trim() ?? "";
  const website = searchParams.get("website")?.trim() ?? null;
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = searchParams.get("load") === "1" || forceRefresh;

  if (!companyName) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }

  const bundle = await getJobInsiderConnectionsBundle({
    userId: dbUser.id,
    companyName,
    jobTitle,
    website,
    allowFetch,
    forceRefresh,
  });

  if (bundle.error && !bundle.hiringManagers.length && !bundle.orgPeople.length && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
