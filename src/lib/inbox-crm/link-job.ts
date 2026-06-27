import type { InboxActivity } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function linkActivityToJob(params: {
  userId: string;
  activityId: string;
  jobId: string | null;
  contactRole?: string | null;
}): Promise<InboxActivity> {
  const activity = await prisma.inboxActivity.findFirst({
    where: { id: params.activityId, userId: params.userId },
    include: { contact: true },
  });
  if (!activity) throw new Error("ACTIVITY_NOT_FOUND");

  if (params.jobId) {
    const job = await prisma.job.findFirst({ where: { id: params.jobId, userId: params.userId } });
    if (!job) throw new Error("JOB_NOT_FOUND");
  }

  const updated = await prisma.inboxActivity.update({
    where: { id: activity.id },
    data: { jobId: params.jobId },
    include: {
      job: { select: { id: true, company: true, role: true, stage: true } },
      contact: { select: { id: true, email: true, name: true, company: true } },
    },
  });

  if (params.jobId && activity.contactId) {
    await prisma.jobInboxContact.upsert({
      where: { jobId_contactId: { jobId: params.jobId, contactId: activity.contactId } },
      create: {
        userId: params.userId,
        jobId: params.jobId,
        contactId: activity.contactId,
        role: params.contactRole ?? null,
      },
      update: {
        ...(params.contactRole ? { role: params.contactRole } : {}),
      },
    });
  }

  return updated;
}

export async function loadContactCard(userId: string, contactId: string, excludeMessageId?: string | null) {
  const contact = await prisma.inboxContact.findFirst({
    where: { id: contactId, userId },
    include: {
      jobLinks: {
        include: { job: { select: { id: true, company: true, role: true, stage: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!contact) return null;

  const timeline = await prisma.inboxActivity.findMany({
    where: {
      userId,
      contactId,
      ...(excludeMessageId ? { NOT: { nylasMessageId: excludeMessageId } } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: 5,
    select: {
      id: true,
      kind: true,
      direction: true,
      category: true,
      subject: true,
      snippet: true,
      occurredAt: true,
      nylasMessageId: true,
      userTag: true,
    },
  });

  return {
    contact: {
      id: contact.id,
      email: contact.email,
      name: contact.name,
      company: contact.company,
      title: contact.title,
      savedToNylas: Boolean(contact.nylasContactId),
    },
    linkedJobs: contact.jobLinks.map((link) => ({
      ...link.job,
      contactRole: link.role,
    })),
    timeline,
  };
}
