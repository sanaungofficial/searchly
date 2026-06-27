import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { syncInboxActivities } from "@/lib/inbox-crm";
import { syncNylasContactsForUser } from "@/lib/inbox-crm/sync-contacts";

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [contacts, inbox] = await Promise.all([
      syncNylasContactsForUser(dbUser.id),
      syncInboxActivities(dbUser.id),
    ]);
    return NextResponse.json({ ok: true, contacts, inbox });
  } catch (err) {
    console.error("[user/inbox/contacts/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
