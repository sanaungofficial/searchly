import type { OrgContact, OrgContactKnownBy, OrgNetworkSource, OrgMember, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isClientAssignedToOrg } from "@/lib/client-assignment";
import { fetchHirebaseCompanyJobs, isHirebaseConfigured } from "@/lib/hirebase";
import { buildMatchRoles, filterMatchingJobs } from "@/lib/job-match";
import { domainFromUrl } from "@/lib/sumble/client";
import { companyFromEmailDomain } from "@/lib/org-contact-graph/normalize-email";

export type ClientTargetCompany = {
  name: string;
  website: string | null;
  key: string;
};

export type OrgIntroMatchRow = {
  id: string;
  targetCompany: string;
  targetCompanyKey: string;
  matchType: string | null;
  strengthScore: number;
  computedAt: string;
  hirebaseJobIds: string[];
  hasOpenRoles: boolean;
  contact: {
    id: string;
    name: string | null;
    email: string;
    company: string | null;
    title: string | null;
    linkedinUrl: string | null;
    lastActivityAt: string | null;
  };
  knownBy: {
    userId: string | null;
    name: string | null;
    email: string | null;
    networkSourceId: string | null;
    strengthScore: number;
    lastSeenAt: string | null;
  };
  hirebaseJobs: Array<{
    id: string;
    title: string;
    url: string | null;
  }>;
};

const MATCH_TYPE_RANK: Record<string, number> = {
  exact: 3,
  domain: 2,
  fuzzy: 1,
};

export function normalizeTargetCompanyKey(name: string, website?: string | null): string {
  const normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const domain = domainFromUrl(website)?.replace(/^www\./, "").split(".")[0] ?? "";
  return domain || normalizedName;
}

export function normalizeCompanyLabel(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function loadClientTargetCompanies(clientId: string): Promise<ClientTargetCompany[]> {
  const user = await prisma.user.findUnique({
    where: { id: clientId },
    include: {
      trackedCompanies: {
        include: { companyIntel: { select: { name: true, website: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!user) return [];

  const seen = new Set<string>();
  const targets: ClientTargetCompany[] = [];

  for (const row of user.trackedCompanies) {
    const name = (row.companyIntel?.name ?? row.name).trim();
    if (!name) continue;
    const website = row.website ?? row.companyIntel?.website ?? null;
    const key = normalizeTargetCompanyKey(name, website);
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ name, website, key });
  }

  return targets;
}

type PooledEdge = OrgContactKnownBy & {
  networkSource: OrgNetworkSource & {
    orgMember: OrgMember & { user: Pick<User, "id" | "email" | "name"> };
  };
};

type PooledContact = OrgContact & { knownBy: PooledEdge[] };

function emailDomain(email: string): string | null {
  return email.split("@")[1]?.toLowerCase() ?? null;
}

export function classifyCompanyMatch(
  contact: Pick<OrgContact, "company" | "email">,
  target: ClientTargetCompany,
): "exact" | "domain" | "fuzzy" | null {
  const contactCompany = contact.company?.trim();
  const targetName = target.name.trim();

  if (contactCompany && normalizeCompanyLabel(contactCompany) === normalizeCompanyLabel(targetName)) {
    return "exact";
  }

  const targetDomain = domainFromUrl(target.website)?.replace(/^www\./, "").toLowerCase();
  const contactDomain = emailDomain(contact.email);
  if (targetDomain && contactDomain) {
    if (contactDomain === targetDomain || contactDomain.endsWith(`.${targetDomain}`)) {
      return "domain";
    }
    const targetBase = targetDomain.split(".")[0];
    const contactBase = contactDomain.split(".")[0];
    if (targetBase && contactBase === targetBase) return "domain";
  }

  const inferred = companyFromEmailDomain(contact.email);
  if (inferred && normalizeCompanyLabel(inferred) === normalizeCompanyLabel(targetName)) {
    return "domain";
  }

  if (contactCompany) {
    const cc = contactCompany.toLowerCase();
    const tn = targetName.toLowerCase();
    if (cc.includes(tn) || tn.includes(cc)) return "fuzzy";
  }

  return null;
}

function pickBestEdge(edges: PooledEdge[]): PooledEdge | null {
  if (edges.length === 0) return null;
  return edges.reduce((best, edge) =>
    edge.strengthScore > best.strengthScore ? edge : best,
  );
}

async function loadPooledContactsForOrg(orgId: string): Promise<PooledContact[]> {
  return prisma.orgContact.findMany({
    where: {
      orgId,
      knownBy: {
        some: {
          networkSource: { visibility: "POOLED", status: "ACTIVE" },
        },
      },
    },
    include: {
      knownBy: {
        where: { networkSource: { visibility: "POOLED", status: "ACTIVE" } },
        include: {
          networkSource: {
            include: {
              orgMember: {
                include: { user: { select: { id: true, email: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });
}

async function fetchMatchingHirebaseJobs(params: {
  clientId: string;
  companyName: string;
  website: string | null;
}): Promise<{ jobIds: string[]; jobs: Array<{ id: string; title: string; url: string | null }> }> {
  if (!isHirebaseConfigured()) {
    return { jobIds: [], jobs: [] };
  }

  const user = await prisma.user.findUnique({
    where: { id: params.clientId },
    include: { profile: true },
  });
  const matchRoles = buildMatchRoles(user?.profile?.targetRoles ?? [], null);
  if (matchRoles.length === 0) {
    return { jobIds: [], jobs: [] };
  }

  try {
    const result = await fetchHirebaseCompanyJobs({
      companyName: params.companyName,
      website: params.website,
      maxJobs: 50,
      pageSize: 50,
    });
    const matched = filterMatchingJobs(result.jobs, matchRoles, 10);
    const jobs = matched.map((job) => ({
      id: job.id,
      title: job.title,
      url: job.url,
    }));
    return { jobIds: jobs.map((j) => j.id), jobs };
  } catch {
    return { jobIds: [], jobs: [] };
  }
}

function serializeMatchRow(row: Awaited<ReturnType<typeof loadCachedOrgIntroMatches>>[number]): OrgIntroMatchRow {
  const hirebaseJobs = Array.isArray(row.hirebaseJobs)
    ? (row.hirebaseJobs as Array<{ id: string; title: string; url: string | null }>)
    : [];

  return {
    id: row.id,
    targetCompany: row.targetCompany,
    targetCompanyKey: row.targetCompanyKey,
    matchType: row.matchType,
    strengthScore: row.strengthScore,
    computedAt: row.computedAt.toISOString(),
    hirebaseJobIds: row.hirebaseJobIds,
    hasOpenRoles: row.hirebaseJobIds.length > 0,
    contact: {
      id: row.contact.id,
      name: row.contact.name,
      email: row.contact.email,
      company: row.contact.company,
      title: row.contact.title,
      linkedinUrl: row.contact.linkedinUrl,
      lastActivityAt: row.contact.lastActivityAt?.toISOString() ?? null,
    },
    knownBy: {
      userId: row.knownByUserId,
      name: row.knownByUserName,
      email: row.knownByNetworkSourceId ? null : null,
      networkSourceId: row.knownByNetworkSourceId,
      strengthScore: row.strengthScore,
      lastSeenAt: null,
    },
    hirebaseJobs,
  };
}

export async function loadCachedOrgIntroMatches(orgId: string, clientId: string) {
  return prisma.orgMatchResult.findMany({
    where: { orgId, clientId },
    include: { contact: true },
    orderBy: [{ strengthScore: "desc" }, { computedAt: "desc" }],
  });
}

export async function computeOrgIntroMatches(params: {
  orgId: string;
  clientId: string;
  companyName?: string | null;
  companyWebsite?: string | null;
  includeHirebase?: boolean;
}): Promise<
  | { ok: true; matches: OrgIntroMatchRow[]; targetsScanned: number }
  | { ok: false; error: string }
> {
  const assigned = await isClientAssignedToOrg(params.orgId, params.clientId);
  if (!assigned) return { ok: false, error: "Client is not assigned to this organization." };

  let targets = await loadClientTargetCompanies(params.clientId);
  if (params.companyName?.trim()) {
    const name = params.companyName.trim();
    const website = params.companyWebsite?.trim() || null;
    const key = normalizeTargetCompanyKey(name, website);
    targets = [{ name, website, key }];
  }

  if (targets.length === 0) {
    return {
      ok: false,
      error: "No target companies for this client — add tracked companies on their profile first.",
    };
  }

  const contacts = await loadPooledContactsForOrg(params.orgId);
  const computedAt = new Date();
  const rowsToUpsert: Array<{
    target: ClientTargetCompany;
    contact: PooledContact;
    matchType: "exact" | "domain" | "fuzzy";
    edge: PooledEdge;
    strengthScore: number;
    hirebaseJobIds: string[];
    hirebaseJobs: Array<{ id: string; title: string; url: string | null }>;
  }> = [];

  for (const target of targets) {
    let hirebaseCache: { jobIds: string[]; jobs: Array<{ id: string; title: string; url: string | null }> } | null =
      null;

    for (const contact of contacts) {
      const matchType = classifyCompanyMatch(contact, target);
      if (!matchType) continue;

      const edge = pickBestEdge(contact.knownBy);
      if (!edge) continue;

      if (params.includeHirebase && !hirebaseCache) {
        hirebaseCache = await fetchMatchingHirebaseJobs({
          clientId: params.clientId,
          companyName: target.name,
          website: target.website,
        });
      }

      rowsToUpsert.push({
        target,
        contact,
        matchType,
        edge,
        strengthScore: edge.strengthScore,
        hirebaseJobIds: hirebaseCache?.jobIds ?? [],
        hirebaseJobs: hirebaseCache?.jobs ?? [],
      });
    }
  }

  rowsToUpsert.sort((a, b) => {
    if (b.strengthScore !== a.strengthScore) return b.strengthScore - a.strengthScore;
    const aRank = MATCH_TYPE_RANK[a.matchType] ?? 0;
    const bRank = MATCH_TYPE_RANK[b.matchType] ?? 0;
    return bRank - aRank;
  });

  await prisma.orgMatchResult.deleteMany({
    where: {
      orgId: params.orgId,
      clientId: params.clientId,
      ...(params.companyName?.trim()
        ? {
            targetCompanyKey: normalizeTargetCompanyKey(
              params.companyName.trim(),
              params.companyWebsite,
            ),
          }
        : {}),
    },
  });

  for (const row of rowsToUpsert) {
    const member = row.edge.networkSource.orgMember.user;
    await prisma.orgMatchResult.create({
      data: {
        orgId: params.orgId,
        clientId: params.clientId,
        targetCompany: row.target.name,
        targetCompanyKey: row.target.key,
        contactId: row.contact.id,
        strengthScore: row.strengthScore,
        matchType: row.matchType,
        knownByUserId: member.id,
        knownByUserName: member.name ?? member.email,
        knownByNetworkSourceId: row.edge.networkSourceId,
        hirebaseJobIds: row.hirebaseJobIds,
        hirebaseJobs: row.hirebaseJobs,
        computedAt,
      },
    });
  }

  const cached = await loadCachedOrgIntroMatches(params.orgId, params.clientId);
  const matches = cached.map((row) => {
    const serialized = serializeMatchRow(row);
    const edge = rowsToUpsert.find((r) => r.contact.id === row.contactId)?.edge;
    return {
      ...serialized,
      knownBy: {
        ...serialized.knownBy,
        email: edge?.networkSource.orgMember.user.email ?? null,
        lastSeenAt: edge?.lastSeenAt?.toISOString() ?? null,
      },
    };
  });

  return { ok: true, matches, targetsScanned: targets.length };
}

export async function listOrgIntroMatches(orgId: string, clientId: string) {
  const assigned = await isClientAssignedToOrg(orgId, clientId);
  if (!assigned) return { ok: false as const, error: "Client is not assigned to this organization." };

  const rows = await loadCachedOrgIntroMatches(orgId, clientId);
  const sourceIds = rows
    .map((r) => r.knownByNetworkSourceId)
    .filter((id): id is string => Boolean(id));

  const edges =
    sourceIds.length > 0
      ? await prisma.orgContactKnownBy.findMany({
          where: { networkSourceId: { in: sourceIds } },
          include: {
            networkSource: {
              include: { orgMember: { include: { user: { select: { email: true } } } } },
            },
          },
        })
      : [];

  const edgeByKey = new Map(
    edges.map((edge) => [`${edge.orgContactId}:${edge.networkSourceId}`, edge]),
  );

  const matches = rows.map((row) => {
    const serialized = serializeMatchRow(row);
    const edge = row.knownByNetworkSourceId
      ? edgeByKey.get(`${row.contactId}:${row.knownByNetworkSourceId}`)
      : null;
    return {
      ...serialized,
      knownBy: {
        ...serialized.knownBy,
        email: edge?.networkSource.orgMember.user.email ?? null,
        lastSeenAt: edge?.lastSeenAt?.toISOString() ?? null,
      },
    };
  });

  return { ok: true as const, matches };
}

export async function listTopOrgIntroMatchesAcrossClients(orgId: string, limit = 10) {
  const rows = await prisma.orgMatchResult.findMany({
    where: { orgId },
    include: { contact: true, client: { select: { id: true, email: true, name: true } } },
    orderBy: [{ strengthScore: "desc" }, { computedAt: "desc" }],
    take: limit,
  });

  return rows.map((row) => ({
    ...serializeMatchRow(row),
    client: {
      id: row.client.id,
      email: row.client.email,
      name: row.client.name,
    },
  }));
}
