import {
  TopEchelonClient,
  getTopEchelonCredentials,
  getTopEchelonSearchId,
} from "@/lib/topechelon/client";
import {
  TopEchelonMfaRequiredError,
  TopEchelonSessionExpiredError,
} from "@/lib/topechelon/errors";
import { mapTopEchelonNetworkJob } from "@/lib/topechelon/map-network-job";
import {
  loadTopEchelonSession,
  recordTopEchelonSyncResult,
  saveTopEchelonSession,
} from "@/lib/topechelon/session-store";
import type { TopEchelonSyncSummary } from "@/lib/topechelon/types";
import { prisma } from "@/lib/prisma";

export type RunTopEchelonSyncOptions = {
  /** 6-digit email verification code for new-device MFA */
  mfaCode?: string;
  /** Force password login even if a stored session exists */
  forceLogin?: boolean;
  /** Saved Big Biller job search UUID (from /jobs/searches/:id/results/network) */
  searchId?: string;
  /** Only fetch this many jobs (for smoke tests) */
  limit?: number;
  /** Cap pagination when not using limit */
  maxPages?: number;
};

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
  const jobs = await client.fetchAllNetworkJobs({
    perPage: 50,
    maxPages: options.maxPages ?? (options.limit ? 1 : 40),
    limit: options.limit,
    searchId,
  });
  let upserted = 0;

  for (const job of jobs) {
    const mapped = mapTopEchelonNetworkJob(job);
    await prisma.networkJob.upsert({
      where: { externalId: mapped.externalId },
      create: mapped,
      update: mapped,
    });
    upserted += 1;
  }

  await saveTopEchelonSession(client.getSession());
  await recordTopEchelonSyncResult(true);

  return {
    fetched: jobs.length,
    upserted,
    pages: Math.ceil(jobs.length / 50) || 0,
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
