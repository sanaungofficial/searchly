import { NextResponse } from "next/server";
import {
  runTopEchelonSync,
  TopEchelonMfaRequiredError,
  TopEchelonSessionExpiredError,
} from "@/lib/topechelon/sync";
import { recordTopEchelonSyncResult } from "@/lib/topechelon/session-store";

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

  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const fullParam = url.searchParams.get("full");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 50) : undefined;
    const fullCatalog = fullParam === "1" || fullParam === "true" || !limit;

    const summary = await runTopEchelonSync(
      fullCatalog ? { fullCatalog: true } : limit ? { limit } : { fullCatalog: true }
    );
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    if (err instanceof TopEchelonMfaRequiredError || err instanceof TopEchelonSessionExpiredError) {
      const message = err.message;
      await recordTopEchelonSyncResult(false, message);
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          error: message,
          hint: "Weekly cron needs a stored session. Run admin sync once with mfaCode after checking email.",
        },
        { status: 428 }
      );
    }

    const message = err instanceof Error ? err.message : "Cron sync failed";
    await recordTopEchelonSyncResult(false, message);
    console.error("[cron topechelon-sync]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
