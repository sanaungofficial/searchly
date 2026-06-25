import {
  TopEchelonClient,
  getTopEchelonCredentials,
  getTopEchelonSearchId,
} from "@/lib/topechelon/client";
import {
  TopEchelonMfaRequiredError,
  TopEchelonSessionExpiredError,
} from "@/lib/topechelon/errors";
import { mapTopEchelonNetworkJob, toNetworkJobDbRecord } from "@/lib/topechelon/map-network-job";
import { mapTopEchelonNetworkRecruiter } from "@/lib/topechelon/map-network-recruiter";
import {
  loadTopEchelonSession,
  recordTopEchelonSyncResult,
  saveTopEchelonSession,
} from "@/lib/topechelon/session-store";
import type { TopEchelonNetworkJobRaw, TopEchelonSyncSummary } from "@/lib/topechelon/types";
import { prisma } from "@/lib/prisma";

export type RunTopEchelonSyncOptions = {
  mfaCode?: string;
  forceLogin?: boolean;
  searchId?: string;
  limit?: number;
  maxPages?: number;
  /** Skip detail fetch (list rows only — missing comments / full description). */
  listOnly?: boolean;
};

const DETAIL_CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function upsertNetworkRecruiter(job: TopEchelonNetworkJobRaw): Promise<string | null> {
  const mapped = mapTopEchelonNetworkRecruiter(job);
  if (!mapped) return null;

  const row = await prisma.networkRecruiter.upsert({
    where: { externalId: mapped.externalId },
    create: {
      externalId: mapped.externalId,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      name: mapped.name,
      email: mapped.email,
      phone: mapped.phone,
      agencyName: mapped.agencyName,
      raw: mapped.raw,
    },
    update: {
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      name: mapped.name,
      email: mapped.email,
      phone: mapped.phone,
      agencyName: mapped.agencyName,
      raw: mapped.raw,
      syncedAt: new Date(),
    },
  });

  return row.id;
}

async function upsertNetworkJob(
  dbFields: ReturnType<typeof toNetworkJobDbRecord>,
  recruiterRecordId: string | null
): Promise<void> {
  const data = { ...dbFields, recruiterRecordId };

  // TE list rows use numeric ids; detail payloads can differ. Prefer an existing row
  // keyed by networkId (e.g. OH229-2755929) so re-syncs update instead of inserting twice.
  if (dbFields.networkId) {
    const existing = await prisma.networkJob.findFirst({
      where: { networkId: dbFields.networkId },
      select: { externalId: true },
    });
    if (existing && existing.externalId !== dbFields.externalId) {
      await prisma.networkJob.update({
        where: { externalId: existing.externalId },
        data,
      });
      return;
    }
  }

  await prisma.networkJob.upsert({
    where: { externalId: dbFields.externalId },
    create: data,
    update: data,
  });
}

export async function runTopEchelonSync(
  options: RunTopEchelonSyncOptions = {}
): Promise<TopEchelonSyncSummary> {
  const started = Date.now();
  let client: TopEchelonClient;
  const stored = options.forceLogin ? null : await loadTopEchelonSession();

  if (stored?.tokenPayload && !options.mfaCode) {
    client = new TopEchelonClient(stored);
    try {
      await client.refreshSession();
    } catch (err) {
      if (!(err instanceof TopEchelonSessionExpiredError)) throw err;
      client = await loginClient(options.mfaCode);
    }
  } else {
    client = await loginClient(options.mfaCode);
  }

  await saveTopEchelonSession(client.getSession());

  const searchId = options.searchId ?? getTopEchelonSearchId() ?? undefined;
  const listJobs = await client.fetchAllNetworkJobs({
    perPage: 50,
    maxPages: options.maxPages ?? (options.limit ? 1 : 40),
    limit: options.limit,
    searchId,
  });

  const jobs = options.listOnly
    ? listJobs
    : await mapWithConcurrency(listJobs, DETAIL_CONCURRENCY, async (row) => {
        const detail = await client.fetchNetworkJobDetail(String(row.id)).catch(() => row);
        return {
          ...detail,
          id: row.id,
          network_id: detail.network_id ?? detail.networkId ?? row.network_id ?? row.networkId,
          networkId: detail.networkId ?? detail.network_id ?? row.networkId ?? row.network_id,
        };
      });

  let upserted = 0;

  for (const job of jobs) {
    const dbFields = toNetworkJobDbRecord(job);
    const recruiterRecordId = await upsertNetworkRecruiter(job);

    await upsertNetworkJob(dbFields, recruiterRecordId);
    upserted += 1;
  }

  await saveTopEchelonSession(client.getSession());
  await recordTopEchelonSyncResult(true);

  return {
    fetched: jobs.length,
    upserted,
    pages: Math.ceil(listJobs.length / 50) || 0,
    searchId,
    durationMs: Date.now() - started,
  };
}

async function loginClient(mfaCode?: string): Promise<TopEchelonClient> {
  const creds = getTopEchelonCredentials();
  if (!creds) {
    throw new Error("TOPECHELON_EMAIL and TOPECHELON_PASSWORD are not configured.");
  }

  const client = new TopEchelonClient();
  try {
    await client.login({
      ...creds,
      newDeviceMfaCode: mfaCode,
      mfaCode,
    });
    return client;
  } catch (err) {
    if (err instanceof TopEchelonMfaRequiredError && !mfaCode) {
      throw err;
    }
    throw err;
  }
}

export { TopEchelonMfaRequiredError, TopEchelonSessionExpiredError };
