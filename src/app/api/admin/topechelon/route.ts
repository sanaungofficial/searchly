import { requireAdmin } from "@/lib/auth";
import { getTopEchelonSyncStatus } from "@/lib/topechelon/session-store";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = await getTopEchelonSyncStatus();
  return NextResponse.json({
    ...status,
    configured: !!(process.env.TOPECHELON_EMAIL && process.env.TOPECHELON_PASSWORD),
    searchId: process.env.TOPECHELON_SEARCH_ID ?? null,
  });
}
