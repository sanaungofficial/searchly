import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { syncWatchlistToSumbleList } from "@/lib/sumble-lists-service";

/** Sync Kimchi watchlist companies to a Sumble organization list (opt-in POST). */
export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { load?: boolean } | null;
  if (body?.load !== true) {
    return NextResponse.json({ error: "Pass { load: true } to sync watchlist." }, { status: 400 });
  }

  const result = await syncWatchlistToSumbleList({ userId: dbUser.id });

  if (result.error && !result.listId) {
    return NextResponse.json(result, { status: result.configured ? 502 : 503 });
  }

  return NextResponse.json(result);
}
