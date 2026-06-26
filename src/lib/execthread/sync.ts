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

export async function runExecThreadSync(
  options: RunExecThreadSyncOptions = {},
): Promise<ExecThreadSyncSummary> {
  const started = Date.now();
  const limit = options.limit && options.limit > 0 ? options.limit : 5;

  if (!execthreadConfigured()) {
    throw new Error("EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD are not configured.");
  }

  let client: ExecThreadClient;
  let authenticated = false;
  const stored = options.forceLogin ? null : await loadExecThreadSession();

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
    const exportMeta = job._kimchiExport as {
      publicPreview?: unknown;
      redeem?: unknown;
    } | undefined;
    if (exportMeta?.publicPreview) previewHits += 1;
    if (exportMeta?.redeem) redeemHits += 1;

    const dbFields = toExecThreadNetworkJobDbRecord(job);
    const recruiterRecordId = await upsertExecThreadRecruiter(job);
    await upsertExecThreadJob(dbFields, recruiterRecordId);
    upserted += 1;
  }

  await saveExecThreadSession(client.getSession());
  await recordExecThreadSyncResult(true);

  return {
    fetched: jobs.length,
    upserted,
    totalHits,
    durationMs: Date.now() - started,
    authenticated,
    previewHits,
    redeemHits,
  };
}

export { ExecThreadSessionExpiredError };
