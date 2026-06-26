import { NextRequest, NextResponse } from "next/server";
import { getCoachEmailGrant, getCoachProfileForEmailAccess } from "@/lib/coach-email-server";
import { isNylasConfigured } from "@/lib/nylas";
import { listMessages, serializeMessageSummary } from "@/lib/nylas-inbox";

export async function GET(req: NextRequest) {
  const coachProfileId = req.nextUrl.searchParams.get("coachId") ?? undefined;
  const ctx = await getCoachProfileForEmailAccess(coachProfileId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getCoachEmailGrant(ctx.profile.id);
  if (!grant) {
    return NextResponse.json({ error: "Coach inbox not connected — enable email sync when connecting calendar." }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const folderId = sp.get("folderId") ?? undefined;
  const pageToken = sp.get("pageToken") ?? undefined;
  const q = sp.get("q")?.trim();
  const limit = Math.min(Number(sp.get("limit") ?? 30), 50);

  try {
    const { messages, nextCursor } = await listMessages(grant.nylasGrantId, {
      folderId,
      pageToken,
      limit,
      searchQueryNative: q || undefined,
    });

    return NextResponse.json({
      email: grant.email,
      messages: messages.map(serializeMessageSummary),
      nextCursor,
    });
  } catch (err) {
    console.error("[coach/email/messages]", err);
    return NextResponse.json({ error: "Could not load messages" }, { status: 500 });
  }
}
