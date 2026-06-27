import { prisma } from "@/lib/prisma";

/** Keep denormalized lastActivityAt in sync when activities are logged. */
export async function touchContactLastActivity(contactId: string | null | undefined, occurredAt: Date) {
  if (!contactId) return;
  await prisma.inboxContact.updateMany({
    where: {
      id: contactId,
      OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: occurredAt } }],
    },
    data: { lastActivityAt: occurredAt },
  });
}
