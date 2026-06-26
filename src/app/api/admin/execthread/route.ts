import { requireAdmin } from "@/lib/auth";
import { getExecThreadSyncStatus } from "@/lib/execthread/session-store";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = await getExecThreadSyncStatus();
  const hasEmail = !!process.env.EXECTHREAD_EMAIL?.trim();
  const hasPassword = !!process.env.EXECTHREAD_PASSWORD?.trim();
  const missingEnv: string[] = [];
  if (!hasEmail) missingEnv.push("EXECTHREAD_EMAIL");
  if (!hasPassword) missingEnv.push("EXECTHREAD_PASSWORD");

  return NextResponse.json({
    ...status,
    configured: hasEmail && hasPassword,
    hasEmail,
    hasPassword,
    missingEnv,
    emailHint: hasEmail ? maskEmail(process.env.EXECTHREAD_EMAIL!) : null,
    apiBase: process.env.EXECTHREAD_API_BASE ?? "https://api.execthread.com/api",
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  const shown = local.length <= 2 ? local[0] ?? "?" : `${local.slice(0, 2)}…`;
  return `${shown}@${domain}`;
}
