import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { isSumbleConfigured } from "@/lib/sumble/client";
import { revealEmailByLinkedIn } from "@/lib/sumble/insider-connections";

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSumbleConfigured()) {
    return NextResponse.json({ error: "Sumble not configured" }, { status: 503 });
  }

  let body: { linkedinUrl?: string };
  try {
    body = (await request.json()) as { linkedinUrl?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const linkedinUrl = normalizeLinkedInUrl(body.linkedinUrl ?? "");
  if (!linkedinUrl) {
    return NextResponse.json({ error: "Valid LinkedIn profile URL required" }, { status: 400 });
  }

  const result = await revealEmailByLinkedIn(linkedinUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Could not reveal email" }, { status: 502 });
  }

  return NextResponse.json({
    email: result.email,
    name: result.name,
    title: result.title,
    linkedinUrl,
  });
}
