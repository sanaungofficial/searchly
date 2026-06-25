import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getDataNestDashboardBundle } from "@/lib/datanest-dashboard-service";

/** DataNest job market intelligence for dashboard — trending roles, employers, matched categories. */
export async function GET(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const allowFetch = searchParams.get("load") === "1" || forceRefresh;

  const bundle = await getDataNestDashboardBundle({
    userId: dbUser.id,
    allowFetch,
    forceRefresh,
  });

  const hasData =
    bundle.trending.length > 0 ||
    bundle.matchedCategories.length > 0 ||
    bundle.topEmployers.length > 0;

  if (bundle.error && !hasData && !bundle.requiresLoad) {
    return NextResponse.json(bundle, { status: bundle.configured ? 502 : 503 });
  }

  return NextResponse.json(bundle);
}
