import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { prisma } from "@/lib/prisma";
import {
  aggregateJobSearchMetrics,
  aggregateRelationshipMetrics,
} from "@/lib/search-metrics";

/** GET /api/user/search-metrics — job pipeline + networking lead metrics for dashboard / coach review */
export async function GET(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [jobs, contacts] = await Promise.all([
    prisma.job.findMany({
      where: { userId: dbUser.id },
      select: { stage: true, appliedAt: true, createdAt: true },
    }),
    prisma.inboxContact.findMany({
      where: { userId: dbUser.id },
      select: { status: true, statusUpdatedAt: true },
    }),
  ]);

  return NextResponse.json({
    jobs: aggregateJobSearchMetrics(jobs),
    relationships: aggregateRelationshipMetrics(contacts),
  });
}
