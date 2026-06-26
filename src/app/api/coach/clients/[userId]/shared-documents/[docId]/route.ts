import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { getCoachProfileForUser } from "@/lib/coach-hub";
import { deleteCoachSharedDocumentStorage } from "@/lib/coach-shared-documents";
import { prisma } from "@/lib/prisma";

async function getCoachActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const me = await prisma.user.findUnique({ where: { email: user.email } });
  if (!me || me.role !== UserRole.COACH) return null;
  const coachProfile = await getCoachProfileForUser(me.id, me.role);
  if (!coachProfile) return null;
  return { me, coachProfile };
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string; docId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId, docId } = await params;

  const doc = await prisma.coachSharedDocument.findFirst({
    where: {
      id: docId,
      clientUserId,
      coachProfileId: actor.coachProfile.id,
    },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await deleteCoachSharedDocumentStorage(doc.storagePath);
  await prisma.coachSharedDocument.delete({ where: { id: doc.id } });

  return NextResponse.json({ ok: true });
}
