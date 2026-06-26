import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { isNylasConfigured } from "@/lib/nylas";
import { sendMessage, serializeMessageSummary } from "@/lib/nylas-inbox";
import { getUserEmailGrant } from "@/lib/user-email-server";

function parseRecipients(raw: unknown): Array<{ email: string; name?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const email = typeof (row as { email?: string }).email === "string" ? (row as { email: string }).email.trim() : "";
      if (!email) return null;
      const name = typeof (row as { name?: string }).name === "string" ? (row as { name: string }).name.trim() : undefined;
      return { email, name };
    })
    .filter((r): r is { email: string; name?: string } => r !== null);
}

export async function POST(req: NextRequest) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getUserEmailGrant(dbUser.id);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    body?: string;
    to?: unknown;
    cc?: unknown;
    bcc?: unknown;
    replyToMessageId?: string;
  };

  const subject = body.subject?.trim() ?? "";
  const text = body.body?.trim() ?? "";
  const to = parseRecipients(body.to);

  if (!subject || !text || !to.length) {
    return NextResponse.json({ error: "Subject, body, and at least one recipient are required" }, { status: 400 });
  }

  try {
    const sent = await sendMessage(grant.nylasGrantId, {
      subject,
      body: text,
      to,
      cc: parseRecipients(body.cc),
      bcc: parseRecipients(body.bcc),
      replyToMessageId: body.replyToMessageId?.trim() || undefined,
    });

    if (!sent) return NextResponse.json({ error: "Send failed" }, { status: 500 });

    return NextResponse.json({ ok: true, message: serializeMessageSummary(sent) });
  } catch (err) {
    console.error("[user/email/messages/send]", err);
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json(
      {
        error: message.includes("403") || message.includes("insufficient")
          ? "Gmail send permission missing — disconnect and reconnect your inbox to grant compose access."
          : "Could not send message",
      },
      { status: 500 },
    );
  }
}
