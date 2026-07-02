import { prisma } from "@/lib/prisma";
import { parseStrengthFactors, type OrgContactStrengthFactors } from "@/lib/org-contact-graph/types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Deterministic 0–100 score from ingest metadata (no message bodies). */
export function computeOrgContactStrengthScore(factors: OrgContactStrengthFactors): number {
  const now = Date.now();

  const lastEmail = factors.lastEmailAt ? new Date(factors.lastEmailAt).getTime() : 0;
  const lastMeeting = factors.lastMeetingAt ? new Date(factors.lastMeetingAt).getTime() : 0;
  const lastActivity = Math.max(lastEmail, lastMeeting);

  let recency = 0;
  if (lastActivity > 0) {
    const daysSince = (now - lastActivity) / MS_PER_DAY;
    recency = 25 * Math.exp(-daysSince / 90);
  }

  const totalTouches = factors.emailCount + factors.meetingCount;
  const frequency = Math.min(20, Math.sqrt(totalTouches) * 4);

  const bidirectional =
    factors.inboundCount > 0 && factors.outboundCount > 0
      ? 15
      : factors.inboundCount > 0 || factors.outboundCount > 0
        ? 5
        : 0;

  const threadDepth = Math.min(15, factors.emailCount * 1.5);

  const meetingQuality = Math.min(
    25,
    factors.oneOnOneMeetingCount * 5 + factors.groupMeetingCount * 2,
  );

  return Math.round(Math.min(100, recency + frequency + bidirectional + threadDepth + meetingQuality));
}

export async function recomputeStrengthScoresForNetworkSource(networkSourceId: string): Promise<number> {
  const edges = await prisma.orgContactKnownBy.findMany({
    where: { networkSourceId },
    select: { id: true, strengthFactors: true, strengthScore: true },
  });

  let updated = 0;
  for (const edge of edges) {
    const score = computeOrgContactStrengthScore(parseStrengthFactors(edge.strengthFactors));
    if (score !== edge.strengthScore) {
      await prisma.orgContactKnownBy.update({
        where: { id: edge.id },
        data: { strengthScore: score },
      });
    }
    updated += 1;
  }
  return updated;
}

export async function recomputeStrengthScoresForOrg(orgId: string): Promise<number> {
  const edges = await prisma.orgContactKnownBy.findMany({
    where: { orgContact: { orgId } },
    select: { id: true, strengthFactors: true, strengthScore: true },
  });

  let updated = 0;
  for (const edge of edges) {
    const score = computeOrgContactStrengthScore(parseStrengthFactors(edge.strengthFactors));
    if (score !== edge.strengthScore) {
      await prisma.orgContactKnownBy.update({
        where: { id: edge.id },
        data: { strengthScore: score },
      });
    }
    updated += 1;
  }
  return updated;
}

export async function recomputeAllPooledStrengthScores(): Promise<number> {
  const edges = await prisma.orgContactKnownBy.findMany({
    where: {
      networkSource: { visibility: "POOLED" },
    },
    select: { id: true, strengthFactors: true, strengthScore: true },
  });

  let updated = 0;
  for (const edge of edges) {
    const score = computeOrgContactStrengthScore(parseStrengthFactors(edge.strengthFactors));
    if (score !== edge.strengthScore) {
      await prisma.orgContactKnownBy.update({
        where: { id: edge.id },
        data: { strengthScore: score },
      });
    }
    updated += 1;
  }
  return updated;
}
