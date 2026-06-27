import { prisma } from "@/lib/prisma";
import {
  ExecThreadClient,
  execthreadConfigured,
  getExecThreadCredentials,
  parseExecThreadTotalHits,
} from "@/lib/execthread/client";
import { ExecThreadSessionExpiredError } from "@/lib/execthread/errors";
import { toExecThreadNetworkJobDbRecord } from "@/lib/execthread/map-network-job";
import {
  mapExecThreadPrimaryRecruiter,
  toNetworkRecruiterRecord,
} from "@/lib/execthread/map-network-recruiter";
import {
  loadExecThreadSession,
  recordExecThreadSyncResult,
  saveExecThreadSession,
} from "@/lib/execthread/session-store";
import type { ExecThreadListingRaw, ExecThreadSyncSummary } from "@/lib/execthread/types";

export type RunExecThreadSyncOptions = {
  limit?: number;
  forceLogin?: boolean;
};

export type RunExecThreadCatalogImportOptions = {
  from?: number;
  size?: number;
  /** When true (default), upsert search summaries without full redeem/export. */
  listOnly?: boolean;
  forceLogin?: boolean;
};

type ExportHitCounts = {
  previewHits: number;
  redeemHits: number;
};

async function upsertExecThreadRecruiter(job: ExecThreadListingRaw): Promise<string | null> {
  const mapped = mapExecThreadPrimaryRecruiter(job);
  if (!mapped) return null;

  const record = toNetworkRecruiterRecord(mapped);
  const row = await prisma.networkRecruiter.upsert({
    where: { externalId: record.externalId },
    create: {
      externalId: record.externalId,
      firstName: record.firstName,
      lastName: record.lastName,
      name: record.name,
      email: record.email,
      phone: record.phone,
      agencyName: record.agencyName,
      raw: record.raw,
    },
    update: {
      firstName: record.firstName,
      lastName: record.lastName,
      name: record.name,
      email: record.email,
      phone: record.phone,
      agencyName: record.agencyName,
      raw: record.raw,
      syncedAt: new Date(),
    },
  });

  return row.id;
}

async function upsertExecThreadJob(
  dbFields: ReturnType<typeof toExecThreadNetworkJobDbRecord>,
  recruiterRecordId: string | null,
): Promise<void> {
  const data = { ...dbFields, recruiterRecordId };
  await prisma.networkJob.upsert({
    where: {
      source_externalId: {
        source: "EXECTHREAD",
        externalId: dbFields.externalId,
      },
    },
    create: data,
    update: data,
  });
}

async function loginClient(): Promise<ExecThreadClient> {
  const creds = getExecThreadCredentials();
  if (!creds) {
    throw new Error("EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD are not configured.");
  }
  const client = new ExecThreadClient();
  await client.login(creds);
  return client;
}

async function getAuthenticatedExecThreadClient(forceLogin: boolean): Promise<{
  client: ExecThreadClient;
  authenticated: boolean;
}> {
  let client: ExecThreadClient;
  let authenticated = false;
  const stored = forceLogin ? null : await loadExecThreadSession();

  if (stored?.cookies?.length) {
    client = new ExecThreadClient(stored);
    authenticated = await client.sessionLooksValid();
    if (!authenticated) {
      try {
        client = await loginClient();
        authenticated = true;
      } catch (err) {
        if (!(err instanceof ExecThreadSessionExpiredError)) throw err;
        client = await loginClient();
        authenticated = true;
      }
    }
  } else {
    client = await loginClient();
    authenticated = true;
  }

  await saveExecThreadSession(client.getSession());
  return { client, authenticated };
}

function exportHitCounts(job: ExecThreadListingRaw): ExportHitCounts {
  const exportMeta = job._kimchiExport as {
    publicPreview?: unknown;
    redeem?: unknown;
  } | undefined;
  return {
    previewHits: exportMeta?.publicPreview ? 1 : 0,
    redeemHits: exportMeta?.redeem ? 1 : 0,
  };
}

async function persistExecThreadListing(job: ExecThreadListingRaw): Promise<void> {
  const dbFields = toExecThreadNetworkJobDbRecord(job);
  const recruiterRecordId = await upsertExecThreadRecruiter(job);
  await upsertExecThreadJob(dbFields, recruiterRecordId);
}

/** Build a minimal search row from a stored DB job for re-export. */
export function searchRowFromStoredExecThreadJob(row: {
  externalId: string;
  networkId: string | null;
  raw: unknown;
}): ExecThreadListingRaw | null {
  const raw = row.raw as ExecThreadListingRaw | null;
  const externalId = raw?._id?.trim() || row.externalId?.trim();
  if (!externalId) return null;

  const slug = raw?.slug?.trim() || row.networkId?.trim() || undefined;
  if (raw && typeof raw === "object") {
    return { ...raw, _id: externalId, slug };
  }
  return { _id: externalId, slug };
}

export async function runExecThreadSync(
  options: RunExecThreadSyncOptions = {},
): Promise<ExecThreadSyncSummary> {
  const started = Date.now();
  const limit = options.limit && options.limit > 0 ? options.limit : 5;

  if (!execthreadConfigured()) {
    throw new Error("EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD are not configured.");
  }

  const { client, authenticated } = await getAuthenticatedExecThreadClient(options.forceLogin === true);

  const searchPreview = await client.fetchSearchPage(limit, 0);
  const totalHits = parseExecThreadTotalHits(searchPreview.metadata);

  const jobs = await client.fetchListingsWithDetails(limit);

  let upserted = 0;
  let previewHits = 0;
  let redeemHits = 0;

  for (const job of jobs) {
    const hits = exportHitCounts(job);
    previewHits += hits.previewHits;
    redeemHits += hits.redeemHits;
    await persistExecThreadListing(job);
    upserted += 1;
  }

  await saveExecThreadSession(client.getSession());
  await recordExecThreadSyncResult(true);

  return {
    mode: "import",
    fetched: jobs.length,
    upserted,
    totalHits,
    durationMs: Date.now() - started,
    authenticated,
    previewHits,
    redeemHits,
  };
}

/** Preview ET catalog size using configured search filters (e.g. US + Canada). */
export async function previewExecThreadCatalogTotal(
  options: Pick<RunExecThreadSyncOptions, "forceLogin"> = {},
): Promise<{ totalHits: number | null; authenticated: boolean }> {
  if (!execthreadConfigured()) {
    throw new Error("EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD are not configured.");
  }

  const { client, authenticated } = await getAuthenticatedExecThreadClient(options.forceLogin === true);
  const search = await client.fetchSearchPage(1, 0);
  await saveExecThreadSession(client.getSession());
  return {
    totalHits: parseExecThreadTotalHits(search.metadata),
    authenticated,
  };
}

/** Import one paginated page from ET search (list-only by default — fast for large catalogs). */
export async function runExecThreadImportSearchPage(
  options: RunExecThreadCatalogImportOptions = {},
): Promise<ExecThreadSyncSummary> {
  const started = Date.now();
  const from = Math.max(0, options.from ?? 0);
  const size = options.size && options.size > 0 ? Math.min(options.size, 100) : 100;
  const listOnly = options.listOnly !== false;

  if (!execthreadConfigured()) {
    throw new Error("EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD are not configured.");
  }

  const { client, authenticated } = await getAuthenticatedExecThreadClient(options.forceLogin === true);
  const search = await client.fetchSearchPage(size, from);
  const totalHits = parseExecThreadTotalHits(search.metadata);
  const summaries = search.results ?? [];

  let upserted = 0;
  let previewHits = 0;
  let redeemHits = 0;

  for (const row of summaries) {
    try {
      const job = listOnly ? row : await client.fetchListingFullExport(row);
      const hits = exportHitCounts(job);
      previewHits += hits.previewHits;
      redeemHits += hits.redeemHits;
      await persistExecThreadListing(job);
      upserted += 1;
    } catch (err) {
      console.warn(`[execthread] catalog import failed for ${row._id}:`, err);
    }
  }

  await saveExecThreadSession(client.getSession());
  await recordExecThreadSyncResult(true);

  const nextFrom = summaries.length >= size ? from + summaries.length : null;

  return {
    mode: "catalog-import",
    fetched: summaries.length,
    upserted,
    totalHits,
    durationMs: Date.now() - started,
    authenticated,
    previewHits,
    redeemHits,
    from,
    nextFrom,
    listOnly,
  };
}

/** Re-fetch full export for specific ExecThread jobs already stored in Kimchi. */
export async function runExecThreadRefreshByExternalIds(
  externalIds: string[],
  options: Pick<RunExecThreadSyncOptions, "forceLogin"> = {},
): Promise<ExecThreadSyncSummary> {
  const started = Date.now();
  const ids = [...new Set(externalIds.map((id) => id.trim()).filter(Boolean))];

  if (!ids.length) {
    return {
      mode: "refresh",
      fetched: 0,
      upserted: 0,
      failed: 0,
      totalHits: null,
      durationMs: Date.now() - started,
      authenticated: false,
      previewHits: 0,
      redeemHits: 0,
    };
  }

  if (!execthreadConfigured()) {
    throw new Error("EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD are not configured.");
  }

  const storedJobs = await prisma.networkJob.findMany({
    where: { source: "EXECTHREAD", externalId: { in: ids } },
    select: { externalId: true, networkId: true, raw: true },
  });

  const { client, authenticated } = await getAuthenticatedExecThreadClient(options.forceLogin === true);

  let upserted = 0;
  let failed = 0;
  let previewHits = 0;
  let redeemHits = 0;

  for (const row of storedJobs) {
    const searchRow = searchRowFromStoredExecThreadJob(row);
    if (!searchRow) {
      failed += 1;
      continue;
    }

    try {
      const job = await client.fetchListingFullExport(searchRow);
      const hits = exportHitCounts(job);
      previewHits += hits.previewHits;
      redeemHits += hits.redeemHits;
      await persistExecThreadListing(job);
      upserted += 1;
    } catch (err) {
      failed += 1;
      console.warn(`[execthread] refresh failed for ${searchRow._id}:`, err);
    }
  }

  failed += ids.length - storedJobs.length;

  await saveExecThreadSession(client.getSession());
  await recordExecThreadSyncResult(true);

  return {
    mode: "refresh",
    fetched: storedJobs.length,
    upserted,
    failed,
    totalHits: null,
    durationMs: Date.now() - started,
    authenticated,
    previewHits,
    redeemHits,
  };
}

/** Re-fetch full export for every ExecThread job already stored in Kimchi. */
export async function runExecThreadRefreshExisting(
  options: Pick<RunExecThreadSyncOptions, "forceLogin"> = {},
): Promise<ExecThreadSyncSummary> {
  const started = Date.now();

  if (!execthreadConfigured()) {
    throw new Error("EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD are not configured.");
  }

  const storedJobs = await prisma.networkJob.findMany({
    where: { source: "EXECTHREAD" },
    select: { externalId: true, networkId: true, raw: true },
    orderBy: { syncedAt: "asc" },
  });

  const { client, authenticated } = await getAuthenticatedExecThreadClient(options.forceLogin === true);

  let upserted = 0;
  let failed = 0;
  let previewHits = 0;
  let redeemHits = 0;

  for (const row of storedJobs) {
    const searchRow = searchRowFromStoredExecThreadJob(row);
    if (!searchRow) {
      failed += 1;
      continue;
    }

    try {
      const job = await client.fetchListingFullExport(searchRow);
      const hits = exportHitCounts(job);
      previewHits += hits.previewHits;
      redeemHits += hits.redeemHits;
      await persistExecThreadListing(job);
      upserted += 1;
    } catch (err) {
      failed += 1;
      console.warn(`[execthread] refresh failed for ${searchRow._id}:`, err);
    }
  }

  await saveExecThreadSession(client.getSession());
  await recordExecThreadSyncResult(true);

  return {
    mode: "refresh",
    fetched: storedJobs.length,
    upserted,
    failed,
    totalHits: null,
    durationMs: Date.now() - started,
    authenticated,
    previewHits,
    redeemHits,
  };
}

export { ExecThreadSessionExpiredError };
