import { NextResponse } from "next/server";
import { runExecThreadSync } from "@/lib/execthread/sync";
import { execthreadConfigured } from "@/lib/execthread/client";

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
    const summary = await runExecThreadSync({ limit: 50 });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[cron execthread-sync]", err);
    return NextResponse.json({ error: "Cron run failed" }, { status: 500 });
  }
}
