import { prisma } from "@/lib/prisma";

export type InboxLens = "job_search";

export type ResolvedInboxGrant = {
  nylasGrantId: string;
  email: string | null;
  provider: string | null;
  userId: string;
};

/** One connected inbox per user (job-search Gmail/Outlook). */
export async function resolveInboxGrant(userId: string): Promise<ResolvedInboxGrant | null> {
  const grant = await prisma.userEmailGrant.findUnique({ where: { userId } });
  if (!grant?.nylasGrantId) return null;
  return {
    nylasGrantId: grant.nylasGrantId,
    email: grant.email,
    provider: grant.provider,
    userId,
  };
}

export function parseInboxLens(_value: string | null | undefined): InboxLens {
  return "job_search";
}
