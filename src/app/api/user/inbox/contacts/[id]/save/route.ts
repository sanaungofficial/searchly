import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { saveInboxContactToNylas } from "@/lib/inbox-crm/sync-contacts";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await resolveScopedDbUser(req);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contactId } = await params;

  try {
    const contact = await saveInboxContactToNylas(dbUser.id, contactId);
    return NextResponse.json({
      contact: {
        id: contact.id,
        email: contact.email,
        name: contact.name,
        company: contact.company,
        title: contact.title,
        savedToNylas: Boolean(contact.nylasContactId),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    if (message === "CONTACT_NOT_FOUND") {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }
    if (message === "INBOX_NOT_CONNECTED") {
      return NextResponse.json({ error: "Inbox not connected" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error:
          message === "NYLAS_SAVE_FAILED"
            ? "Could not save to address book — reconnect inbox to grant contacts permission."
            : "Could not save contact",
      },
      { status: 500 },
    );
  }
}
