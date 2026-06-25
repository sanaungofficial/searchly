import { hostnameFromUrl } from "@/lib/company-domain";
import {
  getInsightsCached,
  insightsCacheKey,
  setInsightsCached,
} from "@/lib/insights-cache";
import { prisma } from "@/lib/prisma";
import {
  addOrganizationsToSumbleList,
  createSumbleOrganizationList,
  fetchSumbleOrganizationMatch,
  isSumbleConfigured,
  listSumbleOrganizationLists,
} from "@/lib/sumble";
import {
  assertSumbleCreditsAvailable,
  getSumbleCreditsRemaining,
  SUMBLE_ESTIMATED_COSTS,
  SumbleInsufficientCreditsError,
} from "@/lib/sumble-credits";

const LIST_NAME_PREFIX = "Kimchi Watchlist";
const LIST_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type WatchlistSyncResult = {
  configured: boolean;
  listId: number | null;
  listUrl: string | null;
  listName: string | null;
  companiesAttempted: number;
  organizationsAdded: number;
  creditsUsed: number;
  creditsRemaining: number | null;
  generatedAt: string;
  error?: string;
};

function listCacheKey(userId: string): string {
  return insightsCacheKey("sumble-watchlist-list-id", { userId });
}

function getCachedListId(userId: string): number | null {
  const hit = getInsightsCached<{ listId: number }>(listCacheKey(userId));
  return hit?.listId ?? null;
}

function setCachedListId(userId: string, listId: number): void {
  setInsightsCached(listCacheKey(userId), { listId }, LIST_CACHE_TTL_MS);
}

export async function syncWatchlistToSumbleList(input: {
  userId: string;
  maxCompanies?: number;
}): Promise<WatchlistSyncResult> {
  const configured = isSumbleConfigured();
  const creditsRemaining = getSumbleCreditsRemaining();
  const maxCompanies = Math.min(input.maxCompanies ?? 10, 15);

  const empty: WatchlistSyncResult = {
    configured,
    listId: null,
    listUrl: null,
    listName: null,
    companiesAttempted: 0,
    organizationsAdded: 0,
    creditsUsed: 0,
    creditsRemaining,
    generatedAt: new Date().toISOString(),
  };

  if (!configured) {
    return { ...empty, error: "Sumble is not configured." };
  }

  try {
    assertSumbleCreditsAvailable(SUMBLE_ESTIMATED_COSTS.orgListSync);

    const tracked = await prisma.trackedCompany.findMany({
      where: { userId: input.userId },
      include: { companyIntel: true },
      orderBy: { updatedAt: "desc" },
      take: maxCompanies,
    });

    if (!tracked.length) {
      return { ...empty, error: "Add tracked companies before syncing to Sumble." };
    }

    let creditsUsed = 0;
    let creditsRemainingAfter: number | null = creditsRemaining;
    let listId = getCachedListId(input.userId);
    let listUrl: string | null = null;
    let listName: string | null = null;

    if (listId) {
      const listsResult = await listSumbleOrganizationLists();
      creditsUsed += listsResult.creditsUsed;
      creditsRemainingAfter = listsResult.creditsRemaining ?? creditsRemainingAfter;
      const existing = listsResult.lists.find((l) => l.id === listId);
      if (existing) {
        listUrl = existing.url;
        listName = existing.name;
      } else {
        listId = null;
      }
    }

    if (!listId) {
      const listsResult = await listSumbleOrganizationLists();
      creditsUsed += listsResult.creditsUsed;
      creditsRemainingAfter = listsResult.creditsRemaining ?? creditsRemainingAfter;

      const matchName = `${LIST_NAME_PREFIX}`;
      const existing = listsResult.lists.find((l) => l.name.startsWith(LIST_NAME_PREFIX));
      if (existing) {
        listId = existing.id;
        listUrl = existing.url;
        listName = existing.name;
      } else {
        const created = await createSumbleOrganizationList(matchName);
        listId = created.id;
        listUrl = created.url;
        listName = created.name;
      }
      setCachedListId(input.userId, listId);
    }

    const organizationIds: number[] = [];
    for (const row of tracked) {
      const website = row.website ?? row.companyIntel?.website ?? null;
      const careersUrl = row.careersUrl ?? row.companyIntel?.careersUrl ?? null;
      const domain = hostnameFromUrl(website) ?? hostnameFromUrl(careersUrl);
      const name = row.companyIntel?.name ?? row.name;

      const match = await fetchSumbleOrganizationMatch({ domain, name });
      creditsUsed += match.creditsUsed;
      creditsRemainingAfter = match.creditsRemaining ?? creditsRemainingAfter;
      if (match.organizationId) organizationIds.push(match.organizationId);
    }

    const uniqueIds = [...new Set(organizationIds)];
    let organizationsAdded = 0;

    if (uniqueIds.length && listId) {
      const addResult = await addOrganizationsToSumbleList({
        listId,
        organizationIds: uniqueIds,
      });
      organizationsAdded = addResult.added.length;
    }

    return {
      configured: true,
      listId,
      listUrl,
      listName,
      companiesAttempted: tracked.length,
      organizationsAdded,
      creditsUsed,
      creditsRemaining: creditsRemainingAfter,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message =
      err instanceof SumbleInsufficientCreditsError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Watchlist sync failed.";
    return {
      ...empty,
      error: message,
      creditsRemaining:
        err instanceof SumbleInsufficientCreditsError ? err.creditsRemaining : creditsRemaining,
    };
  }
}
