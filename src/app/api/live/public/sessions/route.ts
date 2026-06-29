import { CoachStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  listPublicCatalogSessions,
  toLiveSessionView,
} from "@/lib/live-session-db";

/** Public webinar catalog — no auth required. */
export async function GET() {
  const rows = await listPublicCatalogSessions();
  const coachIds = [...new Set(rows.map((r) => r.coachProfileId).filter(Boolean))] as string[];
  const coaches =
    coachIds.length > 0
      ? await prisma.coachProfile.findMany({
          where: { id: { in: coachIds }, status: CoachStatus.ACTIVE },
          select: { id: true, slug: true },
        })
      : [];
  const slugMap = new Map(coaches.map((c) => [c.id, c.slug]));

  const sessions = rows.map((row) =>
    toLiveSessionView(row, { coachSlug: row.coachProfileId ? slugMap.get(row.coachProfileId) ?? null : null }),
  );

  return NextResponse.json({ sessions });
}
