import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { syncInboxOnChatOpen } from "@/lib/kimchi-assistant/mail/triage";
import { loadInboxSnapshot } from "@/lib/kimchi-assistant/inbox-suggestions";

export async function POST() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sync, snapshot] = await Promise.all([
    syncInboxOnChatOpen(dbUser.id),
    loadInboxSnapshot(dbUser.id),
  ]);

  return NextResponse.json({
    ...sync,
    snapshot,
  });
}
