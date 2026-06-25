import { NextResponse } from "next/server";
import { runLiveSessionCron } from "@/lib/live-session-cron";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runLiveSessionCron();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[cron live-sessions]", err);
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
