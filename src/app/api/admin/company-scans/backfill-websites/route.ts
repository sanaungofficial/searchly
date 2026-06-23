import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { backfillIntelWebsitesFromCatalog } from "@/lib/company-intel";

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await backfillIntelWebsitesFromCatalog();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin company-scans backfill-websites]", err);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
