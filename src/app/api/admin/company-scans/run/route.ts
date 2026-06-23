import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runCompanyJobsCron } from "@/lib/company-jobs-scan";

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await runCompanyJobsCron();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    console.error("[admin company-scans run]", err);
    return NextResponse.json({ error: "Scan run failed" }, { status: 500 });
  }
}
