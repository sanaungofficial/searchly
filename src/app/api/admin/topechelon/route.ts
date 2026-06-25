import { requireAdmin } from "@/lib/auth";
import { getTopEchelonSyncStatus } from "@/lib/topechelon/session-store";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = await getTopEchelonSyncStatus();
  const hasEmail = !!process.env.TOPECHELON_EMAIL?.trim();
  const hasPassword = !!process.env.TOPECHELON_PASSWORD?.trim();
  const missingEnv: string[] = [];
  if (!hasEmail) missingEnv.push("TOPECHELON_EMAIL");
  if (!hasPassword) missingEnv.push("TOPECHELON_PASSWORD");

  return NextResponse.json({
    ...status,
    configured: hasEmail && hasPassword,
    hasEmail,
    hasPassword,
    missingEnv,
    emailHint: hasEmail ? maskEmail(process.env.TOPECHELON_EMAIL!) : null,
    searchId: process.env.TOPECHELON_SEARCH_ID ?? null,
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  const shown = local.length <= 2 ? local[0] ?? "?" : `${local.slice(0, 2)}…`;
  return `${shown}@${domain}`;
}
