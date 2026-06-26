import { prisma } from "@/lib/prisma";
import { canCoachShareWithClient } from "@/lib/coach-shared-documents";

export type CoachClientSessionNoteView = {
  id: string;
  coachProfileId: string;
  coachName: string;
  clientUserId: string;
  createdByUserId: string;
  createdByName: string | null;
  coachBookingId: string | null;
  sessionAt: string | null;
  sessionTitle: string | null;
  sessionNotes: string | null;
  homework: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(
  row: {
    id: string;
    coachProfileId: string;
    clientUserId: string;
    createdByUserId: string;
    coachBookingId: string | null;
    sessionNotes: string | null;
    homework: string | null;
    createdAt: Date;
    updatedAt: Date;
    coachProfile: { displayName: string };
    createdBy: { name: string | null };
    coachBooking?: { startAt: Date; title: string | null } | null;
  },
): CoachClientSessionNoteView {
  return {
    id: row.id,
    coachProfileId: row.coachProfileId,
    coachName: row.coachProfile.displayName,
    clientUserId: row.clientUserId,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdBy.name,
    coachBookingId: row.coachBookingId,
    sessionAt: row.coachBooking?.startAt.toISOString() ?? null,
    sessionTitle: row.coachBooking?.title ?? null,
    sessionNotes: row.sessionNotes,
    homework: row.homework,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const noteInclude = {
  coachProfile: { select: { displayName: true } },
  createdBy: { select: { name: true } },
  coachBooking: { select: { startAt: true, title: true } },
} as const;

export async function listCoachClientSessionNotes(params: {
  clientUserId: string;
  coachProfileId?: string;
}): Promise<CoachClientSessionNoteView[]> {
  const rows = await prisma.coachClientSessionNote.findMany({
    where: {
      clientUserId: params.clientUserId,
      ...(params.coachProfileId ? { coachProfileId: params.coachProfileId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: noteInclude,
  });
  return rows.map(mapRow);
}

export async function assertCoachCanManageClientNotes(coachProfileId: string, clientUserId: string) {
  const ok = await canCoachShareWithClient(coachProfileId, clientUserId);
  if (!ok) throw new Error("FORBIDDEN");
}

export async function createCoachClientSessionNote(params: {
  coachProfileId: string;
  clientUserId: string;
  createdByUserId: string;
  coachBookingId?: string | null;
  sessionNotes?: string | null;
  homework?: string | null;
}) {
  const sessionNotes = params.sessionNotes?.trim() || null;
  const homework = params.homework?.trim() || null;
  if (!sessionNotes && !homework) {
    throw new Error("Add session notes or homework.");
  }

  await assertCoachCanManageClientNotes(params.coachProfileId, params.clientUserId);

  if (params.coachBookingId) {
    const booking = await prisma.coachBooking.findFirst({
      where: {
        id: params.coachBookingId,
        coachProfileId: params.coachProfileId,
        userId: params.clientUserId,
      },
      select: { id: true },
    });
    if (!booking) throw new Error("Session not found for this client.");
  }

  const row = await prisma.coachClientSessionNote.create({
    data: {
      coachProfileId: params.coachProfileId,
      clientUserId: params.clientUserId,
      createdByUserId: params.createdByUserId,
      coachBookingId: params.coachBookingId ?? null,
      sessionNotes,
      homework,
    },
    include: noteInclude,
  });
  return mapRow(row);
}

export async function updateCoachClientSessionNote(params: {
  noteId: string;
  coachProfileId: string;
  clientUserId: string;
  sessionNotes?: string | null;
  homework?: string | null;
}) {
  const existing = await prisma.coachClientSessionNote.findFirst({
    where: { id: params.noteId, coachProfileId: params.coachProfileId, clientUserId: params.clientUserId },
  });
  if (!existing) throw new Error("NOT_FOUND");

  const sessionNotes =
    params.sessionNotes !== undefined ? (params.sessionNotes?.trim() || null) : existing.sessionNotes;
  const homework =
    params.homework !== undefined ? (params.homework?.trim() || null) : existing.homework;
  if (!sessionNotes && !homework) throw new Error("Session notes or homework is required.");

  const row = await prisma.coachClientSessionNote.update({
    where: { id: existing.id },
    data: { sessionNotes, homework },
    include: noteInclude,
  });
  return mapRow(row);
}

export async function deleteCoachClientSessionNote(params: {
  noteId: string;
  coachProfileId: string;
  clientUserId: string;
}) {
  const existing = await prisma.coachClientSessionNote.findFirst({
    where: { id: params.noteId, coachProfileId: params.coachProfileId, clientUserId: params.clientUserId },
    select: { id: true },
  });
  if (!existing) throw new Error("NOT_FOUND");
  await prisma.coachClientSessionNote.delete({ where: { id: existing.id } });
}
