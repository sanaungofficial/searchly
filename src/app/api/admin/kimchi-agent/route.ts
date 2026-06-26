import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureKimchiAgentAccount } from "@/lib/kimchi-agent-account";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const account = await ensureKimchiAgentAccount();
  if (!account) {
    return NextResponse.json(
      { error: "Set KIMCHI_AGENT_EMAIL and ensure Nylas Agent Accounts domain is registered." },
      { status: 503 },
    );
  }

  const row = await prisma.kimchiAgentAccount.findUnique({ where: { purpose: account.purpose } });
  return NextResponse.json({ account: row ?? account });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const row = await prisma.kimchiAgentAccount.findUnique({ where: { purpose: "pipeline_assistant" } });
  return NextResponse.json({ account: row });
}
