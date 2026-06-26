import { prisma } from "@/lib/prisma";
import type { AirtableSyncMeta, AirtableSyncSummary } from "@/lib/airtable/types";

const SYNC_META_KEY = "integration.airtable-coaches-sync";

async function readMeta(): Promise<AirtableSyncMeta> {
  const row = await prisma.promptConfig.findUnique({ where: { key: SYNC_META_KEY } });
  if (!row?.content) {
    return { lastSyncAt: null, lastSyncError: null, lastSummary: null };
  }
  try {
    return JSON.parse(row.content) as AirtableSyncMeta;
  } catch {
    return { lastSyncAt: null, lastSyncError: null, lastSummary: null };
  }
}

async function writeMeta(meta: AirtableSyncMeta): Promise<void> {
  await prisma.promptConfig.upsert({
    where: { key: SYNC_META_KEY },
    create: {
      key: SYNC_META_KEY,
      label: "Airtable coaches sync",
      description: "Internal JSON metadata for Airtable coach sync runs",
      category: "Integrations",
      content: JSON.stringify(meta),
      defaultContent: "{}",
    },
    update: {
      content: JSON.stringify(meta),
    },
  });
}

export async function recordAirtableSyncResult(ok: boolean, summary?: AirtableSyncSummary, error?: string) {
  const prev = await readMeta();
  const meta: AirtableSyncMeta = {
    lastSyncAt: ok ? new Date().toISOString() : prev.lastSyncAt,
    lastSyncError: ok ? null : error ?? "Sync failed",
    lastSummary: ok && summary
      ? {
          fetched: summary.fetched,
          created: summary.created,
          updated: summary.updated,
          skipped: summary.skipped,
          photoUploaded: summary.photoUploaded,
          photoErrors: summary.photoErrors,
          durationMs: summary.durationMs,
        }
      : prev.lastSummary,
  };
  await writeMeta(meta);
}

export async function getAirtableSyncStatus() {
  const meta = await readMeta();
  const coachCount = await prisma.coachProfile.count();
  const airtableCoachCount = await prisma.coachProfile.count({ where: { airtableId: { not: null } } });

  return {
    ...meta,
    coachCount,
    airtableCoachCount,
  };
}
