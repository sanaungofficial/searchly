import { NextResponse } from "next/server";
import { runJobSearchEmailCron } from "@/lib/comms/job-search-email-cron";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Daily job-search emails: watchlist alerts (backstop) + pipeline follow-ups. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runJobSearchEmailCron();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[cron job-search-emails]", err);
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
