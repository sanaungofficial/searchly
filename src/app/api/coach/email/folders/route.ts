import { NextRequest, NextResponse } from "next/server";
import { getCoachEmailGrant, getCoachProfileForEmailAccess } from "@/lib/coach-email-server";
import { isNylasConfigured } from "@/lib/nylas";
import { fetchFolders, folderDisplayName } from "@/lib/nylas-inbox";

export async function GET(req: NextRequest) {
  const coachProfileId = req.nextUrl.searchParams.get("coachId") ?? undefined;
  const ctx = await getCoachProfileForEmailAccess(coachProfileId);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getCoachEmailGrant(ctx.profile.id);
  if (!grant) {
    return NextResponse.json({ error: "Coach inbox not connected" }, { status: 404 });
  }

  try {
    const folders = await fetchFolders(grant.nylasGrantId);
    return NextResponse.json({
      folders: folders.map((f) => ({
        id: f.id,
        name: folderDisplayName(f),
        unreadCount: f.unread_count ?? 0,
      })),
    });
  } catch (err) {
    console.error("[coach/email/folders]", err);
    return NextResponse.json({ error: "Could not load folders" }, { status: 500 });
  }
}
