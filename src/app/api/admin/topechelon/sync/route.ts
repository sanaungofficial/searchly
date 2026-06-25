import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTopEchelonCredentials } from "@/lib/topechelon/client";
import {
  runTopEchelonSync,
  TopEchelonMfaRequiredError,
  TopEchelonSessionExpiredError,
} from "@/lib/topechelon/sync";
import { recordTopEchelonSyncResult } from "@/lib/topechelon/session-store";

export const maxDuration = 300;

type SyncBody = {
  mfaCode?: string;
  forceLogin?: boolean;
  searchId?: string;
  limit?: number;
  fullCatalog?: boolean;
  listOnly?: boolean;
};

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    /* empty body ok for refresh-token sync */
  }

  if (!getTopEchelonCredentials()) {
    return NextResponse.json(
      {
        ok: false,
        code: "NOT_CONFIGURED",
        error: "Top Echelon credentials are not set on this deployment.",
        hint: "Add TOPECHELON_EMAIL and TOPECHELON_PASSWORD in Vercel environment variables for Preview, then redeploy dev.",
      },
      { status: 503 }
    );
  }

  try {
    const summary = await runTopEchelonSync({
      mfaCode: body.mfaCode?.trim() || undefined,
      forceLogin: body.forceLogin,
      searchId: body.searchId?.trim() || undefined,
      limit: body.fullCatalog ? undefined : typeof body.limit === "number" && body.limit > 0 ? body.limit : undefined,
      fullCatalog: body.fullCatalog === true,
      listOnly: body.listOnly === true,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    if (err instanceof TopEchelonMfaRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          error: err.message,
          hint: "Check your Top Echelon inbox (and spam) for a 6-digit code, paste it in the admin panel, and sync again.",
        },
        { status: 428 }
      );
    }
    if (err instanceof TopEchelonSessionExpiredError) {
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          error: err.message,
          hint: "POST with mfaCode from your email to re-establish the session.",
        },
        { status: 401 }
      );
    }

    const message = err instanceof Error ? err.message : "Sync failed";
    await recordTopEchelonSyncResult(false, message);
    console.error("[admin topechelon sync]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
