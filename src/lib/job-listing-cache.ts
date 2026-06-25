import { prisma } from "@/lib/prisma";
import type { CachedJob } from "@/lib/cached-job";
import type { HirebaseJob } from "@/lib/hirebase";
import { mapHirebaseJob } from "@/lib/hirebase";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";
import { Prisma } from "@prisma/client";

type CachedPayload = {
  cached: CachedJob;
  companyName: string;
  raw?: HirebaseJob;
};

export async function upsertJobListingCache(entries: Array<{
  hirebaseId: string;
  cached: CachedJob;
  companyName: string;
  raw?: HirebaseJob;
}>): Promise<void> {
  const valid = entries.filter((e) => e.hirebaseId.trim());
  if (!valid.length) return;

  await Promise.all(
    valid.map((entry) =>
      prisma.jobListingCache.upsert({
        where: { hirebaseId: entry.hirebaseId.trim() },
        create: {
          hirebaseId: entry.hirebaseId.trim(),
          companyName: entry.companyName,
          payload: {
            cached: entry.cached,
            companyName: entry.companyName,
            raw: entry.raw ?? null,
          } as unknown as Prisma.InputJsonValue,
        },
        update: {
          companyName: entry.companyName,
          payload: {
            cached: entry.cached,
            companyName: entry.companyName,
            raw: entry.raw ?? null,
          } as unknown as Prisma.InputJsonValue,
          fetchedAt: new Date(),
        },
      }),
    ),
  );
}

export async function hydrateJobsFromListingCache(
  jobs: VectorMatchedJob[],
): Promise<VectorMatchedJob[]> {
  const ids = jobs.map((j) => j.hirebaseId?.trim()).filter(Boolean) as string[];
  if (!ids.length) return jobs;

  const rows = await prisma.jobListingCache.findMany({
    where: { hirebaseId: { in: ids } },
  });
  const byId = new Map(rows.map((r) => [r.hirebaseId, r.payload as CachedPayload]));

  return jobs.map((job) => {
    const id = job.hirebaseId?.trim();
    if (!id) return job;
    const hit = byId.get(id);
    if (!hit?.cached) return job;
    return {
      ...hit.cached,
      ...job,
      companyName: job.companyName || hit.companyName,
    };
  });
}

export function sourcesToCacheEntries(
  sources: Array<{ cached: CachedJob; companyName: string; raw: HirebaseJob }>,
): Array<{ hirebaseId: string; cached: CachedJob; companyName: string; raw: HirebaseJob }> {
  return sources
    .map((s) => {
      const hirebaseId = s.raw._id ?? s.cached.hirebaseId ?? "";
      return {
        hirebaseId,
        cached: s.cached.hirebaseId ? s.cached : { ...s.cached, hirebaseId: hirebaseId || undefined },
        companyName: s.companyName,
        raw: s.raw,
      };
    })
    .filter((e) => e.hirebaseId.trim());
}

export function mapCachedPayload(row: { payload: unknown; companyName: string | null }): CachedJob | null {
  const payload = row.payload as CachedPayload | null;
  if (!payload?.cached) return null;
  return mapHirebaseJob(payload.raw ?? (payload.cached as unknown as HirebaseJob));
}
