import { getActingUser } from "@/lib/acting-user";
import { createDeepgramGrantToken, deepgramConfigured } from "@/lib/deepgram";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!deepgramConfigured()) {
    return NextResponse.json({ error: "Voice agent not configured" }, { status: 503 });
  }

  try {
    const token = await createDeepgramGrantToken(120);
    return new NextResponse(token, {
      status: 200,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[voice/agent/token GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token grant failed" },
      { status: 500 },
    );
  }
}
