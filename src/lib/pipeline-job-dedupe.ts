import { jobListingDedupeKey } from "@/lib/cached-job";
import type { KanbanCard } from "@/components/scout/workspace-data";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";
import { prisma } from "@/lib/prisma";

export function pipelineCardDedupeKey(card: KanbanCard): string {
  const ext = card as KanbanCard & { _url?: string };
  return jobListingDedupeKey({
    companyName: card.company,
    title: card.role,
    url: ext._url,
  });
}

export function pipelineJobDedupeKeys(cards: KanbanCard[]): Set<string> {
  const keys = new Set<string>();
  for (const card of cards) {
    keys.add(pipelineCardDedupeKey(card));
  }
  return keys;
}

export function vectorMatchedJobDedupeKey(job: VectorMatchedJob): string {
  return jobListingDedupeKey({
    companyName: job.companyName,
    title: job.title,
    url: job.url,
  });
}

export function filterOutPipelineJobs<T extends { companyName: string; title: string; url?: string | null }>(
  jobs: T[],
  pipelineKeys: Set<string>,
): T[] {
  if (!pipelineKeys.size) return jobs;
  return jobs.filter(
    (job) =>
      !pipelineKeys.has(
        jobListingDedupeKey({
          companyName: job.companyName,
          title: job.title,
          url: job.url,
        }),
      ),
  );
}

/** Pipeline rows already saved/applied/etc. — exclude from recommended feed. */
export async function loadUserPipelineDedupeKeys(userId: string): Promise<Set<string>> {
  const rows = await prisma.job.findMany({
    where: { userId },
    select: { company: true, role: true, url: true },
  });
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(
      jobListingDedupeKey({
        companyName: row.company,
        title: row.role,
        url: row.url,
      }),
    );
  }
  return keys;
}
