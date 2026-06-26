import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCoachProfileForUser } from "@/lib/coach-hub";

async function getDbUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({ where: { email: user.email! } });
}

export async function GET() {
  const me = await getDbUser();
  if (!me || (me.role !== UserRole.COACH && me.role !== UserRole.ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const coachProfile =
    me.role === UserRole.ADMIN
      ? null
      : await getCoachProfileForUser(me.id, me.role);

  const coachProfileId = coachProfile?.id;

  if (me.role === UserRole.COACH && !coachProfileId) {
    return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });
  }

  const bookingFilter = coachProfileId ? { coachProfileId } : {};

  const bookingClients = await prisma.coachBooking.findMany({
    where: bookingFilter,
    select: {
      userId: true,
      guestEmail: true,
      guestName: true,
    },
    distinct: ["guestEmail"],
  });

  const clientEmails = bookingClients
    .map((b) => b.guestEmail?.trim().toLowerCase())
    .filter(Boolean) as string[];
  const clientUserIds = bookingClients.map((b) => b.userId).filter(Boolean) as string[];

  const clients = await prisma.user.findMany({
    where: {
      role: UserRole.USER,
      OR: [
        ...(clientUserIds.length ? [{ id: { in: clientUserIds } }] : []),
        ...(clientEmails.length
          ? clientEmails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } }))
          : []),
      ],
    },
    include: {
      profile: {
        select: {
          headline: true,
          targetRoles: true,
          targetSalary: true,
          resumeUrl: true,
          linkedinUrl: true,
        },
      },
      subscription: { select: { status: true, stripeCurrentPeriodEnd: true } },
      jobs: {
        select: { id: true, company: true, role: true, stage: true, appliedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      coachBookings: coachProfileId
        ? {
            where: { coachProfileId },
            select: { id: true, startAt: true, endAt: true, status: true, title: true },
            orderBy: { startAt: "desc" },
            take: 5,
          }
        : undefined,
      _count: { select: { jobs: true, tailoredResumes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (me.role === UserRole.ADMIN) {
    return NextResponse.json(clients);
  }

  return NextResponse.json(clients);
}
