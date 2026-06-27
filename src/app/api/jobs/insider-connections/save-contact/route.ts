import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { upsertManualInboxContact } from "@/lib/inbox-crm/manual-contact";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { prisma } from "@/lib/prisma";

function placeholderEmail(linkedinUrl: string | null, name: string): string {
  if (linkedinUrl) {
    const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (match?.[1]) {
      return `${match[1].toLowerCase()}@linkedin.placeholder.kimchi`;
    }
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "contact";
  return `${slug}@linkedin.placeholder.kimchi`;
}

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    title?: string | null;
    company?: string | null;
    linkedinUrl?: string | null;
    email?: string | null;
    jobId?: string | null;
    role?: string | null;
    notes?: string | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const linkedinUrl = body.linkedinUrl ? normalizeLinkedInUrl(body.linkedinUrl) : null;
  const email =
    body.email?.trim().toLowerCase() ||
    placeholderEmail(linkedinUrl, name);

  const contact = await upsertManualInboxContact(dbUser.id, {
    email,
    name,
    title: body.title ?? null,
    company: body.company ?? null,
    linkedinUrl,
    notes: body.notes ?? "Saved from Insider Connection",
  });

  if (!contact) {
    return NextResponse.json({ error: "Could not save contact" }, { status: 400 });
  }

  const jobId = body.jobId?.trim();
  if (jobId) {
    const job = await prisma.job.findFirst({ where: { id: jobId, userId: dbUser.id } });
    if (job) {
      await prisma.jobInboxContact.upsert({
        where: { jobId_contactId: { jobId: job.id, contactId: contact.id } },
        create: {
          userId: dbUser.id,
          jobId: job.id,
          contactId: contact.id,
          role: body.role ?? "insider_connection",
        },
        update: {
          role: body.role ?? "insider_connection",
        },
      });
    }
  }

  return NextResponse.json({ ok: true, contactId: contact.id });
}
