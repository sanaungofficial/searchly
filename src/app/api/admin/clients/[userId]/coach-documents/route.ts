import { NextRequest, NextResponse } from "next/server";
import { AssetType, UserRole } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  coachShareStoragePath,
  COACH_SHARE_UPLOAD_TYPES,
  listCoachSharedDocumentsForClient,
  mapCoachSharedDocument,
  deleteCoachSharedDocumentStorage,
} from "@/lib/coach-shared-documents";
import { assetTypeLabel } from "@/lib/asset-types";
import { prisma } from "@/lib/prisma";

const BUCKET = "resumes";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId: clientUserId } = await params;
  const coachProfileId = req.nextUrl.searchParams.get("coachProfileId")?.trim() || undefined;

  const client = await prisma.user.findFirst({
    where: { id: clientUserId, role: UserRole.USER },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const documents = await listCoachSharedDocumentsForClient({
    clientUserId,
    coachProfileId,
  });
  return NextResponse.json({ documents });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = await createClient();
  const { userId: clientUserId } = await params;

  const client = await prisma.user.findFirst({
    where: { id: clientUserId, role: UserRole.USER },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const coachProfileId = String(formData.get("coachProfileId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim() as AssetType;
  const notes = typeof formData.get("notes") === "string" ? formData.get("notes") as string : null;
  const nameOverride = typeof formData.get("name") === "string" ? (formData.get("name") as string).trim() : "";

  if (!coachProfileId) return NextResponse.json({ error: "coachProfileId required" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!COACH_SHARE_UPLOAD_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  const coach = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: { id: true },
  });
  if (!coach) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const storagePath = coachShareStoragePath(coachProfileId, clientUserId, file.name);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const displayName = nameOverride || file.name.replace(/\.[^/.]+$/, "") || assetTypeLabel(type);

  const row = await prisma.coachSharedDocument.create({
    data: {
      coachProfileId,
      clientUserId,
      uploadedByUserId: admin.id,
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
