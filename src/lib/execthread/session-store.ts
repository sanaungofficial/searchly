import { prisma } from "@/lib/prisma";
import type { ExecThreadSessionData } from "@/lib/execthread/types";

const SESSION_ID = "default";

export type ExecThreadCatalogCheckpoint = {
  from: number;
  totalHits: number | null;
  complete: boolean;
};

export async function loadExecThreadSession(): Promise<ExecThreadSessionData | null> {
  const row = await prisma.execThreadSession.findUnique({ where: { id: SESSION_ID } });
  if (!row) return null;
  return {
    cookies: row.cookies as ExecThreadSessionData["cookies"],
  };
}

export async function saveExecThreadSession(session: ExecThreadSessionData): Promise<void> {
  await prisma.execThreadSession.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      cookies: session.cookies,
    },
    update: {
      cookies: session.cookies,
    },
  });
}

export async function loadCatalogImportCheckpoint(): Promise<ExecThreadCatalogCheckpoint> {
  const row = await prisma.execThreadSession.findUnique({ where: { id: SESSION_ID } });
  return {
    from: row?.catalogImportFrom ?? 0,
    totalHits: row?.catalogImportTotalHits ?? null,
    complete: row?.catalogImportComplete ?? false,
  };
}

export async function saveCatalogImportCheckpoint(checkpoint: ExecThreadCatalogCheckpoint): Promise<void> {
  await prisma.execThreadSession.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      cookies: [],
      catalogImportFrom: checkpoint.from,
      catalogImportTotalHits: checkpoint.totalHits,
      catalogImportComplete: checkpoint.complete,
    },
    update: {
      catalogImportFrom: checkpoint.from,
      catalogImportTotalHits: checkpoint.totalHits,
      catalogImportComplete: checkpoint.complete,
    },
  });
}

export async function resetCatalogImportCheckpoint(): Promise<void> {
  await saveCatalogImportCheckpoint({ from: 0, totalHits: null, complete: false });
}

export async function recordExecThreadSyncResult(ok: boolean, error?: string): Promise<void> {
  await prisma.execThreadSession.upsert({
    where: { id: SESSION_ID },
    create: {
      id: SESSION_ID,
      cookies: [],
      lastSyncAt: ok ? new Date() : undefined,
      lastSyncError: ok ? null : error ?? "Sync failed",
    },
    update: {
      lastSyncAt: ok ? new Date() : undefined,
      lastSyncError: ok ? null : error ?? "Sync failed",
    },
  });
}

export async function getExecThreadSyncStatus() {
  const row = await prisma.execThreadSession.findUnique({ where: { id: SESSION_ID } });
  const jobCount = await prisma.networkJob.count({ where: { source: "EXECTHREAD" } });
  return {
    hasSession: Array.isArray(row?.cookies) && (row.cookies as unknown[]).length > 0,
    lastSyncAt: row?.lastSyncAt ?? null,
    lastSyncError: row?.lastSyncError ?? null,
    jobCount,
    catalogImportFrom: row?.catalogImportFrom ?? 0,
    catalogImportTotalHits: row?.catalogImportTotalHits ?? null,
    catalogImportComplete: row?.catalogImportComplete ?? false,
  };
}
