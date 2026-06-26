import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { syncUserInbox } from "@/lib/job-email-agent";
import { isNylasConfigured } from "@/lib/nylas";
import { getUserEmailGrant } from "@/lib/user-email-server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getUserEmailGrant(dbUser.id);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  try {
    const result = await syncUserInbox(dbUser.id);
    await prisma.userEmailGrant.update({
      where: { id: grant.id },
      data: { lastSyncAt: new Date() },
    });
    return NextResponse.json({ ok: true, processed: result.processed });
  } catch (err) {
    console.error("[user/email/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
