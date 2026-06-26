import { createClient } from "@/utils/supabase/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CoachEmailGrant = {
  coachProfileId: string;
  nylasGrantId: string;
  email: string | null;
  nylasEmailSyncEnabled: boolean;
};

export async function getCoachProfileForEmailAccess(coachProfileId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true, email: true },
  });
  if (!dbUser || (dbUser.role !== UserRole.COACH && dbUser.role !== UserRole.ADMIN)) return null;

  if (coachProfileId && dbUser.role === UserRole.ADMIN) {
    const coach = await prisma.coachProfile.findUnique({
      where: { id: coachProfileId },
      select: {
        id: true,
        nylasGrantId: true,
        nylasGrantEmail: true,
        email: true,
        nylasEmailSyncEnabled: true,
        nylasGrantStatus: true,
      },
    });
    return coach ? { dbUser, profile: coach } : null;
  }

  const profile = await prisma.coachProfile.findFirst({
    where: { OR: [{ userId: dbUser.id }, { email: dbUser.email }] },
    select: {
      id: true,
      nylasGrantId: true,
      nylasGrantEmail: true,
      email: true,
      nylasEmailSyncEnabled: true,
      nylasGrantStatus: true,
    },
  });
  if (!profile) return null;
  return { dbUser, profile };
}

export async function getCoachEmailGrant(coachProfileId: string): Promise<CoachEmailGrant | null> {
  const profile = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    select: {
      id: true,
      nylasGrantId: true,
      nylasGrantEmail: true,
      email: true,
      nylasEmailSyncEnabled: true,
      nylasGrantStatus: true,
    },
  });
  if (!profile?.nylasGrantId || !profile.nylasEmailSyncEnabled) return null;
  if (profile.nylasGrantStatus === "expired") return null;

  return {
    coachProfileId: profile.id,
    nylasGrantId: profile.nylasGrantId,
    email: profile.nylasGrantEmail ?? profile.email,
    nylasEmailSyncEnabled: profile.nylasEmailSyncEnabled,
  };
}
