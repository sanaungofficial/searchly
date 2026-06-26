import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type InboxLens = "job_search" | "work";

export type ResolvedInboxGrant = {
  lens: InboxLens;
  nylasGrantId: string;
  email: string | null;
  provider: string | null;
  userId: string;
  coachProfileId?: string;
};

export function parseInboxLens(value: string | null | undefined): InboxLens {
  return value === "work" ? "work" : "job_search";
}

export function isStaffRole(role: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.COACH;
}

async function staffCoachProfile(userId: string, email: string) {
  return prisma.coachProfile.findFirst({
    where: { OR: [{ userId }, { email }] },
    select: {
      id: true,
      nylasGrantId: true,
      nylasGrantEmail: true,
      email: true,
      nylasEmailSyncEnabled: true,
      nylasGrantStatus: true,
    },
  });
}

export async function getWorkInboxAvailability(userId: string, role: string, email: string) {
  if (!isStaffRole(role)) {
    return { available: false, connected: false, email: null as string | null, coachProfileId: null as string | null };
  }

  const profile = await staffCoachProfile(userId, email);
  const connected = Boolean(
    profile?.nylasGrantId && profile.nylasEmailSyncEnabled && profile.nylasGrantStatus !== "expired",
  );

  return {
    available: Boolean(profile),
    connected,
    email: profile?.nylasGrantEmail ?? profile?.email ?? null,
    coachProfileId: profile?.id ?? null,
  };
}

export async function resolveInboxGrant(
  userId: string,
  role: string,
  email: string,
  lens: InboxLens,
): Promise<ResolvedInboxGrant | null> {
  if (lens === "work") {
    if (!isStaffRole(role)) return null;
    const profile = await staffCoachProfile(userId, email);
    if (!profile?.nylasGrantId || !profile.nylasEmailSyncEnabled || profile.nylasGrantStatus === "expired") {
      return null;
    }
    return {
      lens: "work",
      nylasGrantId: profile.nylasGrantId,
      email: profile.nylasGrantEmail ?? profile.email,
      provider: null,
      userId,
      coachProfileId: profile.id,
    };
  }

  const grant = await prisma.userEmailGrant.findUnique({ where: { userId } });
  if (!grant?.nylasGrantId) return null;

  return {
    lens: "job_search",
    nylasGrantId: grant.nylasGrantId,
    email: grant.email,
    provider: grant.provider,
    userId,
  };
}
