import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { executeMailTool } from "@/lib/kimchi-assistant/mail/executor";

export async function POST(req: NextRequest) {
  const { dbUser } = await getActingUser(req);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    tool?: string;
    args?: Record<string, unknown>;
  };

  if (!body.tool || typeof body.tool !== "string") {
    return NextResponse.json({ error: "tool name required" }, { status: 400 });
  }

  const result = await executeMailTool(dbUser.id, body.tool, body.args ?? {});
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result.data);
}
