import { NextResponse } from "next/server";
import { getAirtableCredentials } from "@/lib/airtable/client";
import { runAirtableCoachSync } from "@/lib/airtable/sync-coaches";
import { recordAirtableSyncResult } from "@/lib/airtable/sync-state";

export const maxDuration = 300;

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

  if (!getAirtableCredentials()) {
    return NextResponse.json(
      { ok: false, error: "Airtable not configured" },
      { status: 503 }
    );
  }

  try {
    const summary = await runAirtableCoachSync();
    await recordAirtableSyncResult(true, summary);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron sync failed";
    await recordAirtableSyncResult(false, undefined, message);
    console.error("[cron airtable-coaches-sync]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
