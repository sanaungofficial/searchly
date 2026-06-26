import { NextRequest, NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { resolveInboxGrant } from "@/lib/inbox-lens";
import { isNylasConfigured } from "@/lib/nylas";
import { listMessages, serializeMessageSummary } from "@/lib/nylas-inbox";

export async function GET(req: NextRequest) {
  const { dbUser, error } = await resolveScopedDbUser(req);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await resolveInboxGrant(dbUser.id);
  if (!grant) {
    return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const folderId = sp.get("folderId") ?? undefined;
  const pageToken = sp.get("pageToken") ?? undefined;
  const q = sp.get("q")?.trim();
  const limit = Math.min(Number(sp.get("limit") ?? 30), 50);

  try {
    let messages: Awaited<ReturnType<typeof listMessages>>["messages"];
    let nextCursor: string | null;

    try {
      ({ messages, nextCursor } = await listMessages(grant.nylasGrantId, {
        folderId,
        pageToken,
        limit,
        searchQueryNative: q || undefined,
      }));
    } catch (folderErr) {
      if (!folderId) throw folderErr;
      console.warn("[user/email/messages] folder filter failed, retrying without folder", folderId, folderErr);
      ({ messages, nextCursor } = await listMessages(grant.nylasGrantId, {
        pageToken,
        limit,
        searchQueryNative: q || undefined,
      }));
    }

    const serialized = messages.map((m) => serializeMessageSummary(m));

    return NextResponse.json({
      messages: serialized,
      nextCursor,
    });
  } catch (err) {
    console.error("[user/email/messages]", err);
    return NextResponse.json({ error: "Could not load messages" }, { status: 500 });
  }
}
