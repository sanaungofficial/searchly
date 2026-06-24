import { requireAdmin } from "@/lib/auth";
import {
  runTopEchelonSync,
  TopEchelonMfaRequiredError,
  TopEchelonSessionExpiredError,
} from "@/lib/topechelon/sync";
import { recordTopEchelonSyncResult } from "@/lib/topechelon/session-store";
import { NextResponse } from "next/server";

type SyncBody = {
  mfaCode?: string;
  forceLogin?: boolean;
  searchId?: string;
  /** Smoke test: only import N jobs */
  limit?: number;
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

  try {
    const summary = await runTopEchelonSync({
      mfaCode: body.mfaCode?.trim() || undefined,
      forceLogin: body.forceLogin,
      searchId: body.searchId?.trim() || undefined,
      limit: typeof body.limit === "number" && body.limit > 0 ? body.limit : undefined,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    if (err instanceof TopEchelonMfaRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          error: err.message,
          hint: "Check your email for a 6-digit code and POST again with { \"mfaCode\": \"123456\" }.",
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
