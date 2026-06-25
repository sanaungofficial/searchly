import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

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

export async function findCoachBySlug(slug: string) {
  return prisma.coachProfile.findFirst({
    where: { slug, status: "ACTIVE" },
  });
}

export async function findCoachBySlugOrId(slugOrId: string) {
  const bySlug = await prisma.coachProfile.findFirst({
    where: { slug: slugOrId, status: "ACTIVE" },
  });
  if (bySlug) return bySlug;
  return prisma.coachProfile.findFirst({
    where: { id: slugOrId, status: "ACTIVE" },
  });
}
