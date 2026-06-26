import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { analyzeMessageForUser } from "@/lib/job-email-agent";
import { isKimchiAiConfigured } from "@/lib/llm";
import { isNylasConfigured } from "@/lib/nylas";
import { getUserEmailGrant } from "@/lib/user-email-server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI is not available in this environment." }, { status: 503 });
  }

  const grant = await getUserEmailGrant(dbUser.id);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  const { messageId } = await params;
  const force = req.nextUrl.searchParams.get("force") === "1";

  try {
    const log = await analyzeMessageForUser(dbUser.id, messageId, force);
    if (!log) {
      return NextResponse.json({ ok: true, activity: null, message: "No job-search signal detected." });
    }

    const activity = await prisma.jobActivityLog.findUnique({
      where: { id: log.id },
      include: { job: { select: { id: true, company: true, role: true, stage: true } } },
    });

    return NextResponse.json({ ok: true, activity });
  } catch (err) {
    console.error("[job-agent/analyze]", err);
    const message = err instanceof Error ? err.message : "Analyze failed";
    if (message === "AI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "AI is not available in this environment." }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not analyze message" }, { status: 500 });
  }
}
