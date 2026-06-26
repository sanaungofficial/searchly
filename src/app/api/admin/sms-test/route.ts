import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { normalizeE164 } from "@/lib/comms/sms-allowlist";
import { sendSmsAdminTest, smsAdminStatus } from "@/lib/comms/sms-admin";

/** Admin: Plivo SMS status + test send (respects allowlist only for automated flows; test bypasses gate). */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    adminPhoneHint: "Set SMS_ALLOWLIST or pass ?to= in POST body for test sends.",
    ...smsAdminStatus(),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { to?: string; message?: string };
  const status = smsAdminStatus();

  if (!status.plivoConfigured) {
    return NextResponse.json(
      {
        error:
          "Plivo is not configured — set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, and PLIVO_SOURCE_NUMBER in Vercel.",
      },
      { status: 503 },
    );
  }

  const to = normalizeE164(body.to?.trim() ?? "") ?? normalizeE164(process.env.SMS_ALLOWLIST?.split(",")[0]?.trim() ?? "");
  if (!to) {
    return NextResponse.json(
      { error: "Provide body.to as E.164 (e.g. +14155551234) or set SMS_ALLOWLIST with a test number." },
      { status: 400 },
    );
  }

  const result = await sendSmsAdminTest({ to, body: body.message });

  if (!result.sent) {
    return NextResponse.json(
      { error: "Plivo send failed — check credentials, source number, and A2P 10DLC registration." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    sentTo: to,
    messageUuid: result.messageUuid,
    apiId: result.apiId,
  });
}
