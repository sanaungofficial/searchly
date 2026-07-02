import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { addSuggestedContactsToNetwork } from "@/lib/inbox-crm/suggest-from-inbox-add";

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    contacts?: { email?: string; name?: string | null; company?: string | null; notes?: string | null }[];
  };

  const contacts = Array.isArray(body.contacts) ? body.contacts : [];
  if (contacts.length === 0) {
    return NextResponse.json({ error: "No contacts provided." }, { status: 400 });
  }
  if (contacts.length > 50) {
    return NextResponse.json({ error: "Too many contacts (max 50)." }, { status: 400 });
  }

  try {
    const { added, skipped } = await addSuggestedContactsToNetwork(dbUser.id, contacts);
    return NextResponse.json({ added, skipped, count: added });
  } catch (err) {
    console.error("[user/inbox/contacts/suggest-from-inbox/add]", err);
    return NextResponse.json({ error: "Could not add contacts." }, { status: 500 });
  }
}
