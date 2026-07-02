import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import {
  listInboxContacts,
  parseContactListFilters,
  parseContactSortField,
} from "@/lib/inbox-crm/list-contacts";
import { upsertManualInboxContact } from "@/lib/inbox-crm/manual-contact";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const page = Number(sp.get("page") ?? "1");
  const pageSize = Number(sp.get("pageSize") ?? "25");
  const sort = parseContactSortField(sp.get("sort"));
  const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";
  const q = sp.get("q")?.trim() || undefined;
  const filters = parseContactListFilters(sp.get("filters"));

  const result = await listInboxContacts({
    userId: dbUser.id,
    q,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    sort,
    sortDir,
    filters,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    email?: string;
    name?: string | null;
    company?: string | null;
    title?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    notes?: string | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 });

  const linkedinUrl = body.linkedinUrl?.trim() ? normalizeLinkedInUrl(body.linkedinUrl.trim()) : null;
  if (body.linkedinUrl?.trim() && !linkedinUrl) {
    return NextResponse.json({ error: "Invalid LinkedIn URL" }, { status: 400 });
  }

  try {
    const contact = await upsertManualInboxContact(dbUser.id, {
      email,
      name: body.name?.trim() || null,
      company: body.company?.trim() || null,
      title: body.title?.trim() || null,
      phone: body.phone?.trim() || null,
      linkedinUrl,
      notes: body.notes?.trim() || null,
    });

    if (!contact) return NextResponse.json({ error: "Could not create contact" }, { status: 400 });

    return NextResponse.json({
      ok: true,
      contactId: contact.id,
      contact: {
        id: contact.id,
        email: contact.email,
        name: contact.name,
        company: contact.company,
        title: contact.title,
        phone: contact.phone,
        linkedinUrl: contact.linkedinUrl,
        notes: contact.notes,
        source: contact.source,
      },
    });
  } catch (err) {
    console.error("[user/inbox/contacts POST]", err);
    return NextResponse.json({ error: "Could not create contact" }, { status: 500 });
  }
}
