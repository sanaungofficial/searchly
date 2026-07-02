import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { suggestContactsFromInbox } from "@/lib/inbox-crm/suggest-from-inbox";

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { limit?: number };

  try {
    const suggestions = await suggestContactsFromInbox(dbUser.id, { limit: body.limit });
    return NextResponse.json({
      suggestions,
      count: suggestions.length,
      mode: "rules" as const,
    });
  } catch (err) {
    console.error("[user/inbox/contacts/suggest-from-inbox]", err);
    return NextResponse.json({ error: "Could not suggest contacts." }, { status: 500 });
  }
}
