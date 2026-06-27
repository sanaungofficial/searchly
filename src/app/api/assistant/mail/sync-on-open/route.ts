import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { getKimchiAiSettings } from "@/lib/kimchi-ai-settings";
import { syncInboxOnChatOpen } from "@/lib/kimchi-assistant/mail/triage";
import { loadInboxSnapshot } from "@/lib/kimchi-assistant/inbox-suggestions";

export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { triage?: boolean };
  const settings = await getKimchiAiSettings();
  const shouldTriage = body.triage === true || (body.triage !== false && settings.autoInboxTriageOnOpen);

  if (!shouldTriage) {
    const snapshot = await loadInboxSnapshot(dbUser.id);
    return NextResponse.json({
      connected: snapshot.emailConnected,
      processed: 0,
      pendingCount: snapshot.pendingCount,
      triaged: false,
      snapshot,
      summary: snapshot.emailConnected
        ? `${snapshot.pendingCount} inbox updates in suggestions.`
        : "Inbox not connected.",
    });
  }

  const [sync, snapshot] = await Promise.all([
    syncInboxOnChatOpen(dbUser.id),
    loadInboxSnapshot(dbUser.id),
  ]);

  return NextResponse.json({
    ...sync,
    triaged: true,
    snapshot,
  });
}
