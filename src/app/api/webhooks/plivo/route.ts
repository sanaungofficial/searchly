import { NextRequest, NextResponse } from "next/server";
import { normalizeE164 } from "@/lib/comms/sms-allowlist";

/** Plivo inbound SMS — handles STOP/HELP/START for TCPA opt-out. */
export async function POST(req: NextRequest) {
  let from = "";
  let text = "";

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { From?: string; Text?: string };
    from = body.From ?? "";
    text = body.Text ?? "";
  } else {
    const form = await req.formData().catch(() => null);
    from = String(form?.get("From") ?? "");
    text = String(form?.get("Text") ?? "");
  }

  const phone = normalizeE164(from);
  const keyword = text.trim().toUpperCase();

  if (phone && (keyword === "STOP" || keyword === "UNSUBSCRIBE" || keyword === "CANCEL" || keyword === "END" || keyword === "QUIT")) {
    // TODO(Phase 2): persist smsOptIn=false on CommunicationPreference when schema lands.
    console.info("[webhooks/plivo] STOP received", { phone });
    return plivoXmlReply("You are unsubscribed from Kimchi SMS. Reply START to re-subscribe.");
  }

  if (phone && keyword === "HELP") {
    return plivoXmlReply("Kimchi webinar & coach alerts. Reply STOP to opt out. app.kimchi.so");
  }

  if (phone && keyword === "START") {
    // TODO(Phase 2): persist smsOptIn=true when user re-subscribes via SMS.
    console.info("[webhooks/plivo] START received", { phone });
    return plivoXmlReply("You are re-subscribed to Kimchi SMS alerts.");
  }

  return new NextResponse("", { status: 200 });
}

function plivoXmlReply(message: string): NextResponse {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}
