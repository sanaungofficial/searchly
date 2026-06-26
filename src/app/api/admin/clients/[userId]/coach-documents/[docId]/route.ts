import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteCoachSharedDocumentStorage } from "@/lib/coach-shared-documents";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string; docId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId, docId } = await params;

  const doc = await prisma.coachSharedDocument.findFirst({
    where: { id: docId, clientUserId },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await deleteCoachSharedDocumentStorage(doc.storagePath);
  await prisma.coachSharedDocument.delete({ where: { id: doc.id } });

  return NextResponse.json({ ok: true });
}
