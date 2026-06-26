import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getGuestHubData } from "@/lib/coach-hub";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const userId = sp.get("userId") ?? undefined;
  const email = sp.get("email") ?? undefined;

  if (!userId && !email) {
    return NextResponse.json({ error: "userId or email required" }, { status: 400 });
  }

  const data = await getGuestHubData({ userId, email });
  if (!data) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

  return NextResponse.json(data);
}
