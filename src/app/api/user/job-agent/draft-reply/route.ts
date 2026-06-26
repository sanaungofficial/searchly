import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { draftReplyForMessage } from "@/lib/job-email-agent";
import { isKimchiAiConfigured } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI is not available in this environment." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { messageId?: string };
  if (!body.messageId?.trim()) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  try {
    const result = await draftReplyForMessage(dbUser.id, body.messageId.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error("[job-agent/draft-reply]", err);
    return NextResponse.json({ error: "Could not draft reply" }, { status: 500 });
  }
}
