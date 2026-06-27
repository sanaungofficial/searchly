import { NextResponse } from "next/server";
import { syncAllInboxActivities } from "@/lib/inbox-crm";
import { syncAllNylasContacts } from "@/lib/inbox-crm/sync-contacts";
import { syncAllUserInboxes } from "@/lib/job-email-agent";
import { ensureKimchiAgentAccount } from "@/lib/kimchi-agent-account";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureKimchiAgentAccount().catch((err) => console.error("[cron/email-agent-sync] agent account", err));

  const [inboxCrm, nylasContacts, aiAgent] = await Promise.all([
    syncAllInboxActivities(),
    syncAllNylasContacts(),
    syncAllUserInboxes().catch((err) => {
      console.error("[cron/email-agent-sync] ai agent", err);
      return { users: 0, processed: 0 };
    }),
  ]);

  return NextResponse.json({
    ok: true,
    inboxCrm,
    nylasContacts,
    aiAgent,
    processed: inboxCrm.processed + aiAgent.processed,
  });
}
