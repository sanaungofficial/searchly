import { NextResponse } from "next/server";
import { runRecommendedJobsSnapshotCron } from "@/lib/recommended-jobs-snapshot";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Daily batch: generate recommended job snapshots + optional digest emails. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runRecommendedJobsSnapshotCron();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[cron recommended-jobs-snapshot]", err);
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
