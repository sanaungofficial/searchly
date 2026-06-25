import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAirtableCredentials } from "@/lib/airtable/client";
import { runAirtableCoachSync } from "@/lib/airtable/sync-coaches";
import { recordAirtableSyncResult } from "@/lib/airtable/sync-state";

export const maxDuration = 300;

type SyncBody = {
  limit?: number;
  refreshPhotos?: boolean;
};

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!getAirtableCredentials()) {
    return NextResponse.json(
      {
        ok: false,
        code: "NOT_CONFIGURED",
        error: "Airtable credentials are not set on this deployment.",
        hint: "Add AIRTABLE_API_KEY in Vercel environment variables (Preview + Production), then redeploy.",
      },
      { status: 503 }
    );
  }

  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    /* empty body ok */
  }

  try {
    const summary = await runAirtableCoachSync({
      limit: typeof body.limit === "number" && body.limit > 0 ? body.limit : undefined,
      refreshPhotos: body.refreshPhotos !== false,
    });
    await recordAirtableSyncResult(true, summary);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await recordAirtableSyncResult(false, undefined, message);
    console.error("[admin airtable coaches sync]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
