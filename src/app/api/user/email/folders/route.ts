import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { isNylasConfigured } from "@/lib/nylas";
import { fetchFolders, folderDisplayName, folderSortRank } from "@/lib/nylas-inbox";
import { getUserEmailGrant } from "@/lib/user-email-server";

export async function GET() {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getUserEmailGrant(dbUser.id);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  try {
    const folders = await fetchFolders(grant.nylasGrantId);
    const sorted = [...folders].sort(
      (a, b) => folderSortRank(a) - folderSortRank(b) || folderDisplayName(a).localeCompare(folderDisplayName(b)),
    );
    return NextResponse.json({
      folders: sorted.map((f) => ({
        id: f.id,
        name: folderDisplayName(f),
        attributes: f.attributes ?? [],
        unread_count: f.unread_count ?? 0,
      })),
    });
  } catch (err) {
    console.error("[user/email/folders]", err);
    return NextResponse.json({ error: "Could not load folders" }, { status: 500 });
  }
}
