import type { Job } from "@prisma/client";
import { resolveDbJobKanbanStage } from "@/lib/pipeline-kanban-stage";
import { normalizeContactStatus, type InboxContactStatus } from "@/lib/inbox-crm/contact-status";

export type JobSearchMetrics = {
  activePipeline: number;
  appliedLifetime: number;
  appliedThisWeek: number;
  appliedLast7d: number;
  interviewing: number;
  offers: number;
  funnel: {
    saved: number;
    applied: number;
    interview: number;
    offer: number;
  };
};

export type RelationshipMetrics = {
  new: number;
  inConversation: number;
  meetingScheduled: number;
  archived: number;
  statusUpdatesLast7d: number;
};

export type SearchMetrics = {
  jobs: JobSearchMetrics;
  relationships: RelationshipMetrics;
};

type JobRow = Pick<Job, "stage" | "appliedAt" | "createdAt">;

type ContactRow = {
  status: string | null;
  statusUpdatedAt: Date | null;
};

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function kanbanFromJob(job: JobRow) {
  return resolveDbJobKanbanStage(job.stage, job.appliedAt);
}

export function aggregateJobSearchMetrics(jobs: JobRow[], now = new Date()): JobSearchMetrics {
  const weekStart = startOfWeek(now);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  let activePipeline = 0;
  let appliedLifetime = 0;
  let appliedThisWeek = 0;
  let appliedLast7d = 0;
  let interviewing = 0;
  let offers = 0;
  const funnel = { saved: 0, applied: 0, interview: 0, offer: 0 };

  for (const job of jobs) {
    const kanban = kanbanFromJob(job);
    if (kanban !== "closed") activePipeline += 1;

    if (job.stage === "INTERVIEWING") interviewing += 1;
    if (job.stage === "OFFER") offers += 1;

    if (job.appliedAt) {
      appliedLifetime += 1;
      if (job.appliedAt >= weekStart) appliedThisWeek += 1;
      if (job.appliedAt >= sevenDaysAgo) appliedLast7d += 1;
    }

    if (kanban === "saved") funnel.saved += 1;
    else if (kanban === "applied") funnel.applied += 1;
    else if (kanban === "interview") funnel.interview += 1;
    else if (kanban === "offer") funnel.offer += 1;
  }

  return {
    activePipeline,
    appliedLifetime,
    appliedThisWeek,
    appliedLast7d,
    interviewing,
    offers,
    funnel,
  };
}

export function aggregateRelationshipMetrics(
  contacts: ContactRow[],
  now = new Date(),
): RelationshipMetrics {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const counts: Record<InboxContactStatus, number> = {
    new: 0,
    in_conversation: 0,
    meeting_scheduled: 0,
    archived: 0,
  };
  let statusUpdatesLast7d = 0;

  for (const contact of contacts) {
    const canonical = normalizeContactStatus(contact.status);
    counts[canonical] += 1;
    if (contact.statusUpdatedAt && contact.statusUpdatedAt >= sevenDaysAgo) {
      statusUpdatesLast7d += 1;
    }
  }

  return {
    new: counts.new,
    inConversation: counts.in_conversation,
    meetingScheduled: counts.meeting_scheduled,
    archived: counts.archived,
    statusUpdatesLast7d,
  };
}
