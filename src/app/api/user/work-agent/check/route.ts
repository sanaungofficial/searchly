import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";

/** Work inbox lens removed — one inbox per user. Chat handles work mail later. */
export async function POST(request: NextRequest) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    activities: [],
    followUps: [],
    pendingCount: 0,
    message: "Use Kimchi chat for inbox insights.",
  });
}
