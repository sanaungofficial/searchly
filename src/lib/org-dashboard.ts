import { getClientsForOrg } from "@/lib/client-assignment";
import { countPendingIntrosByClient } from "@/lib/org-intro-tracking";
import { listTopOrgIntroMatchesAcrossClients } from "@/lib/org-network-match";
import { countPooledContributors, listOrgNetworkSourcesForOrg } from "@/lib/org-network-source";
import { profileCompletenessPct } from "@/lib/profile-completeness";
import { prisma } from "@/lib/prisma";

export type OrgOnboardingChecklist = {
  emailConnected: boolean;
  employeesAdded: boolean;
  targetsSet: boolean;
  introPathsFound: boolean;
};

export type OrgDashboardClientRow = {
  userId: string;
  email: string;
  name: string | null;
  assignedAt: string;
  profileComplete: boolean;
  profileCompletenessPct: number;
  hasMatches: boolean;
  matchCount: number;
  introsPending: number;
  targetCompanyCount: number;
};

export async function getOrgDashboardData(orgId: string) {
  const [org, clients, members, topMatches] = await Promise.all([
    prisma.org.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true },
    }),
    getClientsForOrg(orgId),
    listOrgNetworkSourcesForOrg(orgId),
    listTopOrgIntroMatchesAcrossClients(orgId, 10),
  ]);

  if (!org) return null;

  const clientIds = clients.map((c) => c.userId);
  const networkStats = countPooledContributors(members);

  const [profiles, matchCounts, pendingByClient, trackedCounts, pooledContactCount] = await Promise.all([
    prisma.profile.findMany({
      where: { userId: { in: clientIds } },
      select: {
        userId: true,
        name: true,
        email: true,
        resumeUrl: true,
        linkedinUrl: true,
        jobTimeline: true,
        targetSalary: true,
        priorities: true,
        parsedData: true,
      },
    }),
    clientIds.length
      ? prisma.orgMatchResult.groupBy({
          by: ["clientId"],
          where: { orgId, clientId: { in: clientIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    countPendingIntrosByClient(orgId, clientIds),
    clientIds.length
      ? prisma.trackedCompany.groupBy({
          by: ["userId"],
          where: { userId: { in: clientIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    prisma.orgContact.count({
      where: {
        orgId,
        knownBy: {
          some: { networkSource: { visibility: "POOLED" } },
        },
      },
    }),
  ]);

  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const matchCountByClient = new Map(matchCounts.map((r) => [r.clientId, r._count._all]));
  const trackedByClient = new Map(trackedCounts.map((r) => [r.userId, r._count._all]));

  const clientRows: OrgDashboardClientRow[] = clients.map((client) => {
    const profile = profileByUser.get(client.userId);
    const pct = profile
      ? profileCompletenessPct({
          name: profile.name ?? client.name,
          email: profile.email ?? client.email,
          resumeUrl: profile.resumeUrl,
          linkedinUrl: profile.linkedinUrl,
          jobTimeline: profile.jobTimeline,
          targetSalary: profile.targetSalary,
          priorities: profile.priorities,
          parsedData: profile.parsedData as Parameters<typeof profileCompletenessPct>[0]["parsedData"],
        })
      : 0;
    const matchCount = matchCountByClient.get(client.userId) ?? 0;
    return {
      userId: client.userId,
      email: client.email,
      name: client.name,
      assignedAt: client.assignedAt,
      profileComplete: pct >= 70,
      profileCompletenessPct: pct,
      hasMatches: matchCount > 0,
      matchCount,
      introsPending: pendingByClient.get(client.userId) ?? 0,
      targetCompanyCount: trackedByClient.get(client.userId) ?? 0,
    };
  });

  return {
    org,
    clients: clientRows,
    networkCoverage: {
      sharingCount: networkStats.contributing,
      memberCount: networkStats.total,
      pooledContactCount,
    },
    onboarding: {
      emailConnected: networkStats.contributing > 0,
      employeesAdded: clientRows.length > 0,
      targetsSet: clientRows.some((c) => c.targetCompanyCount > 0),
      introPathsFound: clientRows.some((c) => c.hasMatches),
    } satisfies OrgOnboardingChecklist,
    topMatches,
  };
}

export async function getOrgClientDetail(orgId: string, clientUserId: string) {
  const assigned = await prisma.clientAssignment.findFirst({
    where: { orgId, clientId: clientUserId, assignerType: "COMPANY" },
    include: {
      client: { select: { id: true, email: true, name: true } },
    },
  });
  if (!assigned) return null;

  const [profile, trackedCompanies] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId: clientUserId },
      select: {
        name: true,
        email: true,
        resumeUrl: true,
        linkedinUrl: true,
        jobTimeline: true,
        targetSalary: true,
        priorities: true,
        parsedData: true,
        headline: true,
      },
    }),
    prisma.trackedCompany.findMany({
      where: { userId: clientUserId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, website: true },
      take: 50,
    }),
  ]);

  const pct = profile
    ? profileCompletenessPct({
        name: profile.name ?? assigned.client.name,
        email: profile.email ?? assigned.client.email,
        resumeUrl: profile.resumeUrl,
        linkedinUrl: profile.linkedinUrl,
        jobTimeline: profile.jobTimeline,
        targetSalary: profile.targetSalary,
        priorities: profile.priorities,
        parsedData: profile.parsedData as Parameters<typeof profileCompletenessPct>[0]["parsedData"],
      })
    : 0;

  return {
    client: {
      userId: assigned.client.id,
      email: assigned.client.email,
      name: assigned.client.name,
      headline: profile?.headline ?? null,
      profileComplete: pct >= 70,
      profileCompletenessPct: pct,
    },
    trackedCompanies: trackedCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
    })),
  };
}
