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

export async function linkContactToJob(params: {
  userId: string;
  contactId: string;
  jobId: string | null;
  contactRole?: string | null;
  unlinkJobId?: string | null;
}): Promise<void> {
  const contact = await prisma.inboxContact.findFirst({
    where: { id: params.contactId, userId: params.userId },
  });
  if (!contact) throw new Error("CONTACT_NOT_FOUND");

  if (params.jobId) {
    const job = await prisma.job.findFirst({ where: { id: params.jobId, userId: params.userId } });
    if (!job) throw new Error("JOB_NOT_FOUND");

    await prisma.jobInboxContact.upsert({
      where: { jobId_contactId: { jobId: params.jobId, contactId: params.contactId } },
      create: {
        userId: params.userId,
        jobId: params.jobId,
        contactId: params.contactId,
        role: params.contactRole ?? null,
      },
      update: {
        ...(params.contactRole ? { role: params.contactRole } : {}),
      },
    });
    return;
  }

  if (params.unlinkJobId) {
    await prisma.jobInboxContact.deleteMany({
      where: {
        userId: params.userId,
        contactId: params.contactId,
        jobId: params.unlinkJobId,
      },
    });
  }
}

type LoadContactCardOptions = {
  excludeMessageId?: string | null;
  timelineLimit?: number;
};

export async function loadContactCard(userId: string, contactId: string, options?: LoadContactCardOptions) {
  const excludeMessageId = options?.excludeMessageId;
  const timelineLimit = options?.timelineLimit ?? 5;

  const contact = await prisma.inboxContact.findFirst({
    where: { id: contactId, userId },
    include: {
      jobLinks: {
        include: { job: { select: { id: true, company: true, role: true, stage: true } } },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { activities: true } },
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
    take: timelineLimit,
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
    activityCount: contact._count.activities,
  };
}
