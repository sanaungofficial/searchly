import {
  TopEchelonClient,
  getTopEchelonCredentials,
  getTopEchelonSearchId,
} from "@/lib/topechelon/client";
import {
  TopEchelonMfaRequiredError,
  TopEchelonSessionExpiredError,
} from "@/lib/topechelon/errors";
import { countSubresourceHits, mergeNetworkJobExport } from "@/lib/topechelon/job-export";
import { toNetworkJobDbRecord } from "@/lib/topechelon/map-network-job";
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
  /** Cap jobs fetched (admin smoke tests). Omit for full catalog. */
  limit?: number;
  maxPages?: number;
  /** Paginate through the entire TE catalog (~1,700 roles). Default when no limit. */
  fullCatalog?: boolean;
  /** Include on-hold / inactive roles, not just active. Default true when fullCatalog. */
  allStatuses?: boolean;
  /** Skip detail + sub-resource fetch (list rows only — missing comments / full description). */
  listOnly?: boolean;
};

const DETAIL_CONCURRENCY = 4;

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

  if (dbFields.networkId) {
    const existing = await prisma.networkJob.findFirst({
      where: { source: "TOPECHELON", networkId: dbFields.networkId },
      select: { externalId: true },
    });
    if (existing && existing.externalId !== dbFields.externalId) {
      await prisma.networkJob.update({
        where: {
          source_externalId: { source: "TOPECHELON", externalId: existing.externalId },
        },
        data,
      });
      return;
    }
  }

  await prisma.networkJob.upsert({
    where: {
      source_externalId: {
        source: "TOPECHELON",
        externalId: dbFields.externalId,
      },
    },
    create: data,
    update: data,
  });
}

export async function runTopEchelonSync(
  options: RunTopEchelonSyncOptions = {}
): Promise<TopEchelonSyncSummary> {
  const started = Date.now();
  const fullCatalog = options.fullCatalog ?? (!options.limit && !options.listOnly);
  const allStatuses = options.allStatuses ?? fullCatalog;

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
    maxPages: options.maxPages ?? (options.limit ? 1 : fullCatalog ? 120 : 40),
    limit: options.limit,
    searchId,
    fullCatalog,
    allStatuses,
  });

  let detailErrors = 0;
  let subresourceHits = 0;

  const jobs = options.listOnly
    ? listJobs
    : await mapWithConcurrency(listJobs, DETAIL_CONCURRENCY, async (row) => {
        try {
          const exportBundle = await client.fetchNetworkJobFullExport(row);
          subresourceHits += countSubresourceHits(exportBundle);
          if (exportBundle.detail === exportBundle.listSummary) {
            detailErrors += 1;
          }
          return mergeNetworkJobExport(row, exportBundle);
        } catch {
          detailErrors += 1;
          return {
            ...row,
            network_id: row.network_id ?? row.networkId,
            networkId: row.networkId ?? row.network_id,
          } as TopEchelonNetworkJobRaw;
        }
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
    totalCount: null,
    detailErrors,
    subresourceHits,
    fullCatalog,
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
