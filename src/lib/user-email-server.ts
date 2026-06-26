import { prisma } from "@/lib/prisma";

export async function getUserEmailGrant(userId: string) {
  return prisma.userEmailGrant.findUnique({ where: { userId } });
}

export async function getUserEmailGrantOrThrow(userId: string) {
  const grant = await getUserEmailGrant(userId);
  if (!grant) throw new Error("INBOX_NOT_CONNECTED");
  return grant;
}
