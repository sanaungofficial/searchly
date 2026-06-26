import { getActingUser } from "@/lib/acting-user";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Log voice session duration for future credit modeling (no billing in v1). */
export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { durationSeconds?: number; context?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const durationSeconds =
    typeof body.durationSeconds === "number" && body.durationSeconds >= 0
      ? Math.round(body.durationSeconds)
      : 0;
  const context = typeof body.context === "string" ? body.context.slice(0, 64) : "workspace";

  console.info("[assistant/voice-session]", {
    userId: dbUser.id,
    durationSeconds,
    context,
  });

  return NextResponse.json({ ok: true });
}
