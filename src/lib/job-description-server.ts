import { prisma } from "@/lib/prisma";
import { parsedJobToMeta, resolveJobDescriptionText, type JobMeta } from "@/lib/job-meta";

export async function loadJobDescriptionForUser(
  jobId: string,
  userId: string,
): Promise<string | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: { role: true, company: true, notes: true },
  });
  if (!job?.notes?.trim()) return null;

  try {
    const meta = parsedJobToMeta(JSON.parse(job.notes) as Record<string, unknown>);
    const text = resolveJobDescriptionText(meta, job.role, job.company);
    return text.trim() || null;
  } catch {
    const raw = job.notes.trim();
    return raw.length >= 40 ? raw : null;
  }
}

export function resolveJobDescriptionFromNotes(
  notes: string | null | undefined,
  role?: string | null,
  company?: string | null,
): string | null {
  if (!notes?.trim()) return null;
  try {
    const meta = parsedJobToMeta(JSON.parse(notes) as Record<string, unknown>);
    const text = resolveJobDescriptionText(meta, role, company);
    return text.trim() || null;
  } catch {
    const raw = notes.trim();
    return raw.length >= 40 ? raw : null;
  }
}

export type { JobMeta };
