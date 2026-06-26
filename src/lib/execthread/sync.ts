import { prisma } from "@/lib/prisma";
import {
  ExecThreadClient,
  execthreadConfigured,
  getExecThreadCredentials,
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

  const searchPreview = await client.searchListings({
    q: "all",
    sort: "most relevant",
    size: limit,
    from: 0,
  });
  const totalHitsRaw = searchPreview.metadata?.totalHits;
  const totalHits =
    typeof totalHitsRaw === "number"
      ? totalHitsRaw
      : typeof totalHitsRaw === "object" && totalHitsRaw?.value != null
        ? totalHitsRaw.value
        : null;

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
