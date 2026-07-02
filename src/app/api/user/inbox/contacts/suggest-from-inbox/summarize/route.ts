import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { summarizeInboxContactContexts } from "@/lib/inbox-crm/suggest-from-inbox-summarize";

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { emails?: string[] };
  const emails = Array.isArray(body.emails) ? body.emails : [];
  if (emails.length === 0) {
    return NextResponse.json({ error: "No emails provided." }, { status: 400 });
  }
  if (emails.length > 20) {
    return NextResponse.json({ error: "Too many contacts (max 20 per request)." }, { status: 400 });
  }

  try {
    const result = await summarizeInboxContactContexts(dbUser.id, emails);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[user/inbox/contacts/suggest-from-inbox/summarize]", err);
    return NextResponse.json({ error: "Could not summarize contacts." }, { status: 500 });
  }
}
