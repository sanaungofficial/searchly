import type { OrgNetworkSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncOrgNetworkSourceContacts } from "@/lib/org-contact-graph/sync-contacts";
import { syncOrgMemberInboxContacts } from "@/lib/org-contact-graph/sync-inbox-contacts";
import { syncOrgNetworkSourceSignals } from "@/lib/org-contact-graph/sync-signals";
import { recomputeStrengthScoresForNetworkSource, recomputeAllPooledStrengthScores } from "@/lib/org-contact-strength";

export type OrgNetworkSourceWithOrg = OrgNetworkSource & {
  orgMember: { orgId: string; userId: string };
};

const orgNetworkSourceInclude = {
  orgMember: { select: { orgId: true, userId: true } },
} as const;

export function canSyncOrgNetworkSource(
  source: Pick<OrgNetworkSource, "visibility" | "status" | "nylasGrantId">,
) {
  return (
    source.visibility === "POOLED" &&
    source.status === "ACTIVE" &&
    Boolean(source.nylasGrantId)
  );
}

export async function loadOrgNetworkSourceForSync(sourceId: string) {
  return prisma.orgNetworkSource.findUnique({
    where: { id: sourceId },
    include: orgNetworkSourceInclude,
  });
}

export async function syncOrgNetworkSource(sourceId: string) {
  const source = await loadOrgNetworkSourceForSync(sourceId);
  if (!source) return { ok: false as const, reason: "not_found" as const };
  if (!canSyncOrgNetworkSource(source)) {
    return { ok: false as const, reason: "not_pooled_active" as const };
  }

  const [contacts, signals, inboxContacts] = await Promise.all([
    syncOrgNetworkSourceContacts(source),
    syncOrgNetworkSourceSignals(source),
    syncOrgMemberInboxContacts(source.orgMemberId),
  ]);

  await prisma.orgNetworkSource.update({
    where: { id: source.id },
    data: { lastSyncAt: new Date() },
  });

  const strengthScoresUpdated = await recomputeStrengthScoresForNetworkSource(source.id);

  return {
    ok: true as const,
    orgId: source.orgMember.orgId,
    contacts,
    signals,
    inboxContacts,
    strengthScoresUpdated,
  };
}

export async function syncAllPooledOrgNetworkSources() {
  const { syncAllOrgMemberInboxContacts } = await import("@/lib/org-contact-graph/sync-inbox-contacts");
  const inboxBackfill = await syncAllOrgMemberInboxContacts();

  const sources = await prisma.orgNetworkSource.findMany({
    where: {
      visibility: "POOLED",
      status: "ACTIVE",
      nylasGrantId: { not: null },
    },
    select: { id: true },
  });

  let synced = 0;
  let failed = 0;
  for (const source of sources) {
    try {
      const result = await syncOrgNetworkSource(source.id);
      if (result.ok) synced += 1;
    } catch (err) {
      failed += 1;
      console.error("[org-contact-graph] sync source", source.id, err);
    }
  }

  const strengthScoresUpdated = await recomputeAllPooledStrengthScores();

  return {
    sources: sources.length,
    synced,
    failed,
    strengthScoresUpdated,
    inboxMembers: inboxBackfill.members,
    inboxContactsSynced: inboxBackfill.synced,
    inboxSyncFailed: inboxBackfill.failed,
  };
}

export async function countContactsByNetworkSourceIds(sourceIds: string[]) {
  if (sourceIds.length === 0) return new Map<string, number>();

  const rows = await prisma.orgContactKnownBy.groupBy({
    by: ["networkSourceId"],
    where: { networkSourceId: { in: sourceIds } },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.networkSourceId, row._count._all]));
}
