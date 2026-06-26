import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { downloadAttachment } from "@/lib/nylas-inbox";
import { isNylasConfigured } from "@/lib/nylas";
import { getUserEmailGrant } from "@/lib/user-email-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isNylasConfigured()) {
    return NextResponse.json({ error: "Nylas is not configured" }, { status: 503 });
  }

  const grant = await getUserEmailGrant(dbUser.id);
  if (!grant) return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });

  const { id: messageId, attachmentId } = await params;

  try {
    const file = await downloadAttachment(grant.nylasGrantId, attachmentId, messageId);
    if (!file?.content) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    const buffer = Buffer.from(file.content, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.content_type ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.filename ?? "attachment"}"`,
      },
    });
  } catch (err) {
    console.error("[user/email/attachments]", err);
    return NextResponse.json({ error: "Could not download attachment" }, { status: 500 });
  }
}
