import type { AssetType, CoachSharedDocument, Prisma } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { isCoachAssignedToUser } from "@/lib/coach-client-assignment";
import { assetTypeLabel } from "@/lib/asset-types";
import { prisma } from "@/lib/prisma";

const BUCKET = "resumes";
const SIGNED_TTL = 60 * 60 * 24 * 365;

export type CoachSharedDocumentView = {
  id: string;
  coachProfileId: string;
  coachName: string;
  coachPhotoUrl: string | null;
  coachSlug: string | null;
  clientUserId: string | null;
  clientName: string | null;
  uploadedByUserId: string;
  uploadedByName: string | null;
  type: AssetType;
  typeLabel: string;
  name: string;
  url: string;
  mimeType: string | null;
  notes: string | null;
  isPublic: boolean;
  createdAt: string;
};

type DocRow = CoachSharedDocument & {
  coachProfile: { displayName: string; photoUrl: string | null; slug: string | null };
  uploadedBy: { name: string | null };
  clientUser?: { name: string | null; email: string } | null;
};

export async function canCoachShareWithClient(coachProfileId: string, clientUserId: string): Promise<boolean> {
  if (await isCoachAssignedToUser(coachProfileId, clientUserId)) return true;

  const client = await prisma.user.findUnique({
    where: { id: clientUserId },
    select: { email: true },
  });
  if (!client?.email) return false;

  const booking = await prisma.coachBooking.findFirst({
    where: {
      coachProfileId,
      OR: [
        { userId: clientUserId },
        { guestEmail: { equals: client.email, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return Boolean(booking);
}

export async function signCoachDocumentPath(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function mapCoachSharedDocument(row: DocRow): Promise<CoachSharedDocumentView | null> {
  const url = await signCoachDocumentPath(row.storagePath);
  if (!url) return null;

  return {
    id: row.id,
    coachProfileId: row.coachProfileId,
    coachName: row.coachProfile.displayName,
    coachPhotoUrl: row.coachProfile.photoUrl,
    coachSlug: row.coachProfile.slug,
    clientUserId: row.clientUserId,
    clientName: row.clientUser?.name ?? row.clientUser?.email?.split("@")[0] ?? null,
    uploadedByUserId: row.uploadedByUserId,
    uploadedByName: row.uploadedBy.name,
    type: row.type,
    typeLabel: assetTypeLabel(row.type),
    name: row.name,
    url,
    mimeType: row.mimeType,
    notes: row.notes,
    isPublic: row.isPublic,
    createdAt: row.createdAt.toISOString(),
  };
}

const docInclude = {
  coachProfile: { select: { displayName: true, photoUrl: true, slug: true } },
  uploadedBy: { select: { name: true } },
  clientUser: { select: { name: true, email: true } },
} satisfies Prisma.CoachSharedDocumentInclude;

export async function listCoachSharedDocumentsForClient(params: {
  clientUserId: string;
  coachProfileId?: string;
}): Promise<CoachSharedDocumentView[]> {
  const rows = await prisma.coachSharedDocument.findMany({
    where: {
      clientUserId: params.clientUserId,
      isPublic: false,
      ...(params.coachProfileId ? { coachProfileId: params.coachProfileId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: docInclude,
  });

  const mapped = await Promise.all(rows.map((row) => mapCoachSharedDocument(row)));
  return mapped.filter((d): d is CoachSharedDocumentView => d !== null);
}

export async function listPublicCoachResources(coachProfileId: string): Promise<CoachSharedDocumentView[]> {
  const rows = await prisma.coachSharedDocument.findMany({
    where: { coachProfileId, isPublic: true },
    orderBy: { createdAt: "desc" },
    include: docInclude,
  });
  const mapped = await Promise.all(rows.map((row) => mapCoachSharedDocument(row)));
  return mapped.filter((d): d is CoachSharedDocumentView => d !== null);
}

export async function listAllCoachResources(coachProfileId: string): Promise<CoachSharedDocumentView[]> {
  const rows = await prisma.coachSharedDocument.findMany({
    where: { coachProfileId },
    orderBy: { createdAt: "desc" },
    include: docInclude,
  });
  const mapped = await Promise.all(rows.map((row) => mapCoachSharedDocument(row)));
  return mapped.filter((d): d is CoachSharedDocumentView => d !== null);
}

export async function deleteCoachSharedDocumentStorage(storagePath: string) {
  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([storagePath]);
}

export function coachShareStoragePath(
  coachProfileId: string,
  clientUserId: string | null,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const scope = clientUserId ?? "public";
  return `coach-shares/${coachProfileId}/${scope}/${Date.now()}-${safe}`;
}

export const COACH_SHARE_UPLOAD_TYPES: AssetType[] = [
  "JOB_SEARCH_STRATEGY",
  "COVER_LETTER",
  "RESUME",
  "OTHER",
];
