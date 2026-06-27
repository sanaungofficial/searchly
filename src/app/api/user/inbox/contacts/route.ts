import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const q = sp.get("q")?.trim().toLowerCase();

  const contacts = await prisma.inboxContact.findMany({
    where: {
      userId: dbUser.id,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
    include: {
      jobLinks: {
        include: { job: { select: { id: true, company: true, role: true, stage: true } } },
        take: 3,
      },
      activities: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { id: true, subject: true, occurredAt: true, direction: true },
      },
      _count: { select: { activities: true } },
    },
  });

  return NextResponse.json({
    contacts: contacts.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      company: c.company,
      title: c.title,
      savedToNylas: Boolean(c.nylasContactId),
      activityCount: c._count.activities,
      lastActivity: c.activities[0] ?? null,
      linkedJobs: c.jobLinks.map((l) => l.job),
    })),
  });
}
