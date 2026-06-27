import { NextRequest, NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { isInboxContactStatus } from "@/lib/inbox-crm/contact-status";
import { loadContactCard } from "@/lib/inbox-crm/link-job";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const card = await loadContactCard(dbUser.id, id, { timelineLimit: 60 });
  if (!card) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  return NextResponse.json(card);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { dbUser, error } = await resolveScopedDbUser(req);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.inboxContact.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    status?: string | null;
    name?: string | null;
    company?: string | null;
    title?: string | null;
    phone?: string | null;
    notes?: string | null;
    linkedinUrl?: string | null;
    contacted?: boolean | null;
  };

  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (body.status !== null && !isInboxContactStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
    data.statusUpdatedAt = body.status !== null ? new Date() : null;
  }
  if (body.name !== undefined) data.name = body.name?.trim() || null;
  if (body.company !== undefined) data.company = body.company?.trim() || null;
  if (body.title !== undefined) data.title = body.title?.trim() || null;
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.linkedinUrl !== undefined) data.linkedinUrl = body.linkedinUrl?.trim() || null;
  if (body.contacted !== undefined) data.contacted = body.contacted;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await prisma.inboxContact.update({
    where: { id },
    data,
  });

  const card = await loadContactCard(dbUser.id, id, { timelineLimit: 60 });
  return NextResponse.json(card);
}
