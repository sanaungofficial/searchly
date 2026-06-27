import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { syncInboxActivities } from "@/lib/inbox-crm";
import { syncNylasContactsForUser } from "@/lib/inbox-crm/sync-contacts";
import { isNylasConfigured } from "@/lib/nylas";
import { getUserEmailGrant } from "@/lib/user-email-server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getUserEmailGrant(dbUser.id);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  try {
    const [result, contacts] = await Promise.all([
      syncInboxActivities(dbUser.id),
      syncNylasContactsForUser(dbUser.id).catch(() => ({ synced: 0, skipped: true })),
    ]);
    await prisma.userEmailGrant.update({
      where: { id: grant.id },
      data: { lastSyncAt: new Date() },
    });
    return NextResponse.json({ ok: true, processed: result.processed, contactsSynced: contacts.synced });
  } catch (err) {
    console.error("[user/email/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
