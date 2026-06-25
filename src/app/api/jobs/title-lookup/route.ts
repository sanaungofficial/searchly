import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getJobTitleMappingBundle } from "@/lib/sumble-job-contacts-service";

/** Map a job title to Sumble job function + level via POST /v6/jobs/title-lookup. Requires load=1. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim() ?? "";
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = searchParams.get("load") === "1" || forceRefresh;

  if (!title) {
    return NextResponse.json({ error: "title query param is required." }, { status: 400 });
  }

  const bundle = await getJobTitleMappingBundle({ jobTitle: title, allowFetch });

  if (bundle.error && !bundle.mapping && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}

export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; load?: boolean } = {};
  try {
    body = (await request.json()) as { title?: string; load?: boolean };
  } catch {
    // optional body
  }

  const { searchParams } = new URL(request.url);
  const title = body.title?.trim() || searchParams.get("title")?.trim() || "";
  const allowFetch = body.load === true || searchParams.get("load") === "1";

  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const bundle = await getJobTitleMappingBundle({ jobTitle: title, allowFetch });

  if (bundle.error && !bundle.mapping && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
