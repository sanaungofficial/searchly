import { NextResponse } from "next/server";
import { execthreadConfigured } from "@/lib/execthread/client";
import { runExecThreadCronSync } from "@/lib/execthread/sync";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!execthreadConfigured()) {
    return NextResponse.json({ ok: true, skipped: "not configured" });
  }

  try {
    const result = await runExecThreadCronSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron execthread-sync]", err);
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
