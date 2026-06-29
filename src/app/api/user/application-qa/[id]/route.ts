import { NextRequest, NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { normalizeQaTags, serializeApplicationQaEntry } from "@/lib/application-qa";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

async function getOwnedEntry(userId: string, id: string) {
  return prisma.applicationQaEntry.findFirst({ where: { id, userId } });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedEntry(dbUser.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    question?: string;
    answer?: string;
    tags?: unknown;
  };

  const data: { question?: string; answer?: string; tags?: string[] } = {};
  if (body.question !== undefined) {
    const question = body.question.trim();
    if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 });
    data.question = question.slice(0, 2000);
  }
  if (body.answer !== undefined) {
    const answer = body.answer.trim();
    if (!answer) return NextResponse.json({ error: "Answer is required" }, { status: 400 });
    data.answer = answer.slice(0, 8000);
  }
  if (body.tags !== undefined) data.tags = normalizeQaTags(body.tags);

  const row = await prisma.applicationQaEntry.update({ where: { id }, data });
  return NextResponse.json({ entry: serializeApplicationQaEntry(row) });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedEntry(dbUser.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.applicationQaEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
