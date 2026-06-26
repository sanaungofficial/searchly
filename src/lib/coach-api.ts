import { createClient } from "@/utils/supabase/server";
import { CoachStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canUserAccessCoach } from "@/lib/coach-client-assignment";
import { isAdmin } from "@/lib/auth";

export async function getAuthenticatedDbUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, email: true, name: true, role: true },
  });
}

export async function findCoachBySlug(slug: string, userId?: string | null) {
  const coach = await prisma.coachProfile.findFirst({
    where: { slug, status: CoachStatus.ACTIVE },
  });
  if (!coach) return null;
  const admin = userId ? await isAdmin() : false;
  const allowed = await canUserAccessCoach({
    coachProfileId: coach.id,
    userId,
    isAdmin: admin,
    isInternal: coach.isInternal,
  });
  return allowed ? coach : null;
}

export async function findCoachBySlugOrId(slugOrId: string, userId?: string | null) {
  const bySlug = await prisma.coachProfile.findFirst({
    where: { slug: slugOrId, status: CoachStatus.ACTIVE },
  });
  const coach =
    bySlug ??
    (await prisma.coachProfile.findFirst({
      where: { id: slugOrId, status: CoachStatus.ACTIVE },
    }));
  if (!coach) return null;

  const admin = userId ? await isAdmin() : false;
  const allowed = await canUserAccessCoach({
    coachProfileId: coach.id,
    userId,
    isAdmin: admin,
    isInternal: coach.isInternal,
  });
  return allowed ? coach : null;
}
