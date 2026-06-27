import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { getCoachProfileForUser } from "@/lib/coach-hub";
import {
  canCoachShareWithClient,
  deleteCoachSharedDocumentStorage,
  mapCoachSharedDocument,
} from "@/lib/coach-shared-documents";
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { docId } = await params;
  const body = await req.json().catch(() => ({}));
  const doc = await prisma.coachSharedDocument.findFirst({
    where: { id: docId, coachProfileId: actor.coachProfile.id },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPublic = body.isPublic === true;
  const clientUserId =
    typeof body.clientUserId === "string" && body.clientUserId.trim()
      ? body.clientUserId.trim()
      : null;

  if (!isPublic && clientUserId) {
    if (!(await canCoachShareWithClient(actor.coachProfile.id, clientUserId))) {
      return NextResponse.json({ error: "No coaching relationship with this client" }, { status: 403 });
    }
  }

  const updated = await prisma.coachSharedDocument.update({
    where: { id: docId },
    data: {
      isPublic,
      clientUserId: isPublic ? null : clientUserId ?? doc.clientUserId,
    },
    include: {
      coachProfile: { select: { displayName: true, photoUrl: true, slug: true } },
      uploadedBy: { select: { name: true } },
      clientUser: { select: { name: true, email: true } },
    },
  });

  const document = await mapCoachSharedDocument(updated);
  return NextResponse.json({ document });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { docId } = await params;
  const doc = await prisma.coachSharedDocument.findFirst({
    where: { id: docId, coachProfileId: actor.coachProfile.id },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.coachSharedDocument.delete({ where: { id: docId } });
  await deleteCoachSharedDocumentStorage(doc.storagePath);
  return NextResponse.json({ ok: true });
}
