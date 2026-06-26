import { prisma } from "@/lib/prisma";
import {
  ExecThreadClient,
  execthreadConfigured,
  getExecThreadCredentials,
} from "@/lib/execthread/client";
import { ExecThreadSessionExpiredError } from "@/lib/execthread/errors";
import { toExecThreadNetworkJobDbRecord } from "@/lib/execthread/map-network-job";
import {
  loadExecThreadSession,
  recordExecThreadSyncResult,
  saveExecThreadSession,
} from "@/lib/execthread/session-store";
import type { ExecThreadSyncSummary } from "@/lib/execthread/types";

export type RunExecThreadSyncOptions = {
  limit?: number;
  forceLogin?: boolean;
};

async function upsertExecThreadJob(
  dbFields: ReturnType<typeof toExecThreadNetworkJobDbRecord>,
): Promise<void> {
  const data = { ...dbFields, recruiterRecordId: null as string | null };
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
  for (const job of jobs) {
    const dbFields = toExecThreadNetworkJobDbRecord(job);
    await upsertExecThreadJob(dbFields);
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
  };
}

export { ExecThreadSessionExpiredError };
