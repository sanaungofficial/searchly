import { NextResponse } from "next/server";
import { syncAllUserInboxes } from "@/lib/job-email-agent";
import { ensureKimchiAgentAccount } from "@/lib/kimchi-agent-account";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureKimchiAgentAccount().catch((err) => console.error("[cron/email-agent-sync] agent account", err));
  const result = await syncAllUserInboxes();

  return NextResponse.json({ ok: true, ...result });
}
