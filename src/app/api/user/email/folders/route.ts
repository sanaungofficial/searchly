import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { isNylasConfigured } from "@/lib/nylas";
import { fetchFolders } from "@/lib/nylas-inbox";
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
    const sorted = [...folders].sort((a, b) => {
      const rank = (f: typeof a) => {
        const sys = f.system_folder?.toLowerCase() ?? f.name?.toLowerCase() ?? "";
        if (sys.includes("inbox")) return 0;
        if (sys.includes("sent")) return 1;
        if (sys.includes("draft")) return 2;
        if (sys.includes("star")) return 3;
        return 10;
      };
      return rank(a) - rank(b) || (a.name ?? "").localeCompare(b.name ?? "");
    });
    return NextResponse.json({ folders: sorted });
  } catch (err) {
    console.error("[user/email/folders]", err);
    return NextResponse.json({ error: "Could not load folders" }, { status: 500 });
  }
}
