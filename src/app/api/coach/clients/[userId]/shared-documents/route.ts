import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { AssetType, UserRole } from "@prisma/client";
import { getCoachProfileForUser } from "@/lib/coach-hub";
import { assetTypeLabel } from "@/lib/asset-types";
import {
  canCoachShareWithClient,
  coachShareStoragePath,
  COACH_SHARE_UPLOAD_TYPES,
  listCoachSharedDocumentsForClient,
  mapCoachSharedDocument,
  deleteCoachSharedDocumentStorage,
} from "@/lib/coach-shared-documents";
import { prisma } from "@/lib/prisma";

const BUCKET = "resumes";

async function getCoachActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const me = await prisma.user.findUnique({ where: { email: user.email } });
  if (!me || me.role !== UserRole.COACH) return null;
  const coachProfile = await getCoachProfileForUser(me.id, me.role);
  if (!coachProfile) return null;
  return { me, coachProfile, supabase };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId } = await params;
  const client = await prisma.user.findFirst({
    where: { id: clientUserId, role: UserRole.USER },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (!(await canCoachShareWithClient(actor.coachProfile.id, clientUserId))) {
    return NextResponse.json({ error: "No coaching relationship with this client" }, { status: 403 });
  }

  const documents = await listCoachSharedDocumentsForClient({
    clientUserId,
    coachProfileId: actor.coachProfile.id,
  });
  return NextResponse.json({ documents });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const actor = await getCoachActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId } = await params;
  const client = await prisma.user.findFirst({
    where: { id: clientUserId, role: UserRole.USER },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (!(await canCoachShareWithClient(actor.coachProfile.id, clientUserId))) {
    return NextResponse.json({ error: "No coaching relationship with this client" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = String(formData.get("type") ?? "").trim() as AssetType;
  const notes = typeof formData.get("notes") === "string" ? formData.get("notes") as string : null;
  const nameOverride = typeof formData.get("name") === "string" ? (formData.get("name") as string).trim() : "";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!COACH_SHARE_UPLOAD_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  const storagePath = coachShareStoragePath(actor.coachProfile.id, clientUserId, file.name);
  const { error: uploadError } = await actor.supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const displayName = nameOverride || file.name.replace(/\.[^/.]+$/, "") || assetTypeLabel(type);

  const row = await prisma.coachSharedDocument.create({
    data: {
      coachProfileId: actor.coachProfile.id,
      clientUserId,
      uploadedByUserId: actor.me.id,
      type,
      name: displayName,
      storagePath,
      mimeType: file.type || null,
      notes: notes?.trim() || null,
    },
    include: {
      coachProfile: { select: { displayName: true, photoUrl: true, slug: true } },
      uploadedBy: { select: { name: true } },
    },
  });

  const document = await mapCoachSharedDocument(row);
  if (!document) {
    await prisma.coachSharedDocument.delete({ where: { id: row.id } });
    await deleteCoachSharedDocumentStorage(storagePath);
    return NextResponse.json({ error: "Could not generate download URL" }, { status: 500 });
  }

  return NextResponse.json({ document });
}
