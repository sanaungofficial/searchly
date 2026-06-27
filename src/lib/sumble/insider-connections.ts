import {
  buildDecisionMakerLinkedInUrl,
  buildPastCompanyLinkedInUrl,
  buildSchoolLinkedInUrl,
  buildTeamLinkedInUrl,
} from "@/lib/linkedin-people-search";
import { domainFromUrl, sumblePost } from "@/lib/sumble/client";
import type {
  InsiderConnectionBucket,
  InsiderConnectionBucketId,
  InsiderConnectionsJobContext,
  InsiderConnectionsResult,
  SumblePersonPreview,
  UserConnectionProfile,
} from "@/lib/sumble/types";
import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";
import type { ParsedResumeData } from "@/lib/resume-parse";

type SumbleOrgRow = {
  attributes?: { id?: number | null; name?: string | null; url?: string | null } | null;
};

type SumbleOrgsResponse = {
  organizations?: SumbleOrgRow[];
};

type SumbleRelatedPerson = {
  person_id?: number | null;
  sumble_url?: string | null;
  confidence?: { score?: number | null } | null;
  attributes?: {
    name?: string | null;
    job_title?: string | null;
    linkedin_url?: string | null;
    email?: string | null;
  } | null;
};

type SumbleJobRow = {
  job_id?: number | null;
  attributes?: {
    title?: string | null;
    teams?: Array<{ team_id?: number; name?: string; slug?: string }> | null;
  } | null;
  related_people?: SumbleRelatedPerson[] | null;
};

type SumbleJobsResponse = {
  jobs?: SumbleJobRow[];
};

type SumbleTeamRow = {
  team_id?: number | null;
  name?: string | null;
  related_people?: SumbleRelatedPerson[] | null;
};

type SumbleTeamsResponse = {
  teams?: SumbleTeamRow[];
};

type SumblePersonRow = {
  person_id?: number | null;
  attributes?: {
    name?: string | null;
    job_title?: string | null;
    linkedin_url?: string | null;
    email?: string | null;
  } | null;
};

type SumblePeopleResponse = {
  people?: SumblePersonRow[];
  total?: number;
};

function mapRelatedPerson(
  row: SumbleRelatedPerson,
  contextLabel: string | null = null,
): SumblePersonPreview | null {
  const name = row.attributes?.name?.trim();
  if (!name) return null;
  return {
    personId: row.person_id ?? null,
    name,
    title: row.attributes?.job_title?.trim() ?? null,
    linkedinUrl: row.attributes?.linkedin_url?.trim() ?? null,
    email: row.attributes?.email?.trim() ?? null,
    contextLabel,
    confidence: row.confidence?.score ?? null,
  };
}

function mapPersonRow(row: SumblePersonRow, contextLabel: string | null = null): SumblePersonPreview | null {
  const name = row.attributes?.name?.trim();
  if (!name) return null;
  return {
    personId: row.person_id ?? null,
    name,
    title: row.attributes?.job_title?.trim() ?? null,
    linkedinUrl: row.attributes?.linkedin_url?.trim() ?? null,
    email: row.attributes?.email?.trim() ?? null,
    contextLabel,
    confidence: null,
  };
}

function dedupePeople(people: SumblePersonPreview[]): SumblePersonPreview[] {
  const seen = new Set<string>();
  const out: SumblePersonPreview[] = [];
  for (const person of people) {
    const key = person.personId != null ? `id:${person.personId}` : person.linkedinUrl ?? person.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(person);
  }
  return out;
}

export function userConnectionProfileFromProfile(input: {
  parsedData?: ParsedResumeData | null;
  linkedInDraft?: LinkedInProfileDraft | null;
}): UserConnectionProfile {
  const pastCompanies: string[] = [];
  const pastCompanyLabels: string[] = [];
  const schools: string[] = [];
  const schoolLabels: string[] = [];

  const draft = input.linkedInDraft;
  if (draft?.experience?.length) {
    for (const exp of draft.experience) {
      const name = exp.companyRef?.name?.trim() || exp.company?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!pastCompanies.some((c) => c.toLowerCase() === key)) {
        pastCompanies.push(name);
        pastCompanyLabels.push(name);
      }
    }
  } else if (input.parsedData?.workExperience?.length) {
    for (const exp of input.parsedData.workExperience) {
      const name = exp.company?.trim();
      if (!name) continue;
      if (!pastCompanies.some((c) => c.toLowerCase() === name.toLowerCase())) {
        pastCompanies.push(name);
        pastCompanyLabels.push(name);
      }
    }
  }

  if (draft?.education?.length) {
    for (const edu of draft.education) {
      const name = edu.schoolRef?.name?.trim() || edu.school?.trim();
      if (!name) continue;
      if (!schools.some((s) => s.toLowerCase() === name.toLowerCase())) {
        schools.push(name);
        schoolLabels.push(name);
      }
    }
  } else if (input.parsedData?.education?.length) {
    for (const edu of input.parsedData.education) {
      const name = edu.school?.trim();
      if (!name) continue;
      if (!schools.some((s) => s.toLowerCase() === name.toLowerCase())) {
        schools.push(name);
        schoolLabels.push(name);
      }
    }
  }

  return {
    pastCompanies: pastCompanies.slice(0, 8),
    pastCompanyLabels: pastCompanyLabels.slice(0, 8),
    schools: schools.slice(0, 4),
    schoolLabels: schoolLabels.slice(0, 4),
  };
}

async function resolveSumbleOrganizationId(
  job: InsiderConnectionsJobContext,
): Promise<number | null> {
  const domain =
    domainFromUrl(job.companyWebsite) ??
    domainFromUrl(job.linkedinUrl);

  const res = await sumblePost<SumbleOrgsResponse>("/v6/organizations", {
    organizations: [
      {
        name: job.companyName.trim(),
        url: domain ?? undefined,
        location: undefined,
      },
    ],
    select: { attributes: ["id", "name", "url"] },
  });

  if (!res.ok) return null;
  const id = res.data.organizations?.[0]?.attributes?.id;
  return typeof id === "number" ? id : null;
}

async function fetchJobRelatedPeople(
  orgId: number,
  jobTitle: string,
): Promise<{ people: SumblePersonPreview[]; teamIds: number[]; teamName: string | null }> {
  const titleTokens = jobTitle
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 4)
    .join(" ");

  let res = await sumblePost<SumbleJobsResponse>("/v6/jobs", {
    filter: {
      organization_ids: [orgId],
      ...(titleTokens
        ? { query: { query: `title CONTAINS "${titleTokens.replace(/"/g, "")}"` } }
        : {}),
    },
    limit: 3,
    select: {
      attributes: ["title", "teams"],
      related_people: {
        limit: 10,
        attributes: ["name", "job_title", "job_level", "linkedin_url", "confidence"],
      },
    },
  });

  if (!res.ok || !(res.data.jobs?.length)) {
    const fallback = await sumblePost<SumbleJobsResponse>("/v6/jobs", {
      filter: { organization_ids: [orgId] },
      limit: 3,
      select: {
        attributes: ["title", "teams"],
        related_people: {
          limit: 10,
          attributes: ["name", "job_title", "job_level", "linkedin_url", "confidence"],
        },
      },
    });
    if (fallback.ok) {
      res = fallback;
    } else if (!res.ok) {
      return { people: [], teamIds: [], teamName: null };
    }
  }

  const jobs = res.data.jobs ?? [];
  let best: SumbleJobRow | null = null;
  for (const row of jobs) {
    if ((row.related_people?.length ?? 0) > (best?.related_people?.length ?? 0)) {
      best = row;
    }
  }
  if (!best && jobs[0]) best = jobs[0];

  const teams = best?.attributes?.teams ?? [];
  const teamIds = teams.map((t) => t.team_id).filter((id): id is number => typeof id === "number");
  const teamName = teams[0]?.name?.trim() ?? null;

  const people = dedupePeople(
    (best?.related_people ?? [])
      .map((p) => mapRelatedPerson(p))
      .filter((p): p is SumblePersonPreview => Boolean(p)),
  );

  return { people, teamIds, teamName };
}

async function fetchTeamPeople(teamIds: number[]): Promise<SumblePersonPreview[]> {
  if (!teamIds.length) return [];

  const res = await sumblePost<SumbleTeamsResponse>("/v6/teams", {
    teams: teamIds.slice(0, 3),
    select: {
      attributes: ["breadcrumbs"],
      related_people: {
        max_per_team: 8,
        attributes: ["name", "job_title", "job_level", "linkedin_url", "confidence"],
      },
    },
  });

  if (!res.ok) return [];

  const people: SumblePersonPreview[] = [];
  for (const team of res.data.teams ?? []) {
    for (const row of team.related_people ?? []) {
      const mapped = mapRelatedPerson(row, team.name ? `On ${team.name}` : null);
      if (mapped) people.push(mapped);
    }
  }
  return dedupePeople(people);
}

async function fetchOrgPeoplePreview(
  orgId: number,
  limit: number,
  offset: number,
  contextLabel: string | null,
): Promise<SumblePersonPreview[]> {
  const res = await sumblePost<SumblePeopleResponse>("/v6/people", {
    filter: { organization_ids: [orgId] },
    limit,
    offset,
    order_by_column: "job_level",
    order_by_direction: "DESC",
    select: {
      attributes: ["name", "job_title", "job_level", "linkedin_url"],
    },
  });

  if (!res.ok) return [];

  return dedupePeople(
    (res.data.people ?? [])
      .map((row) => mapPersonRow(row, contextLabel))
      .filter((p): p is SumblePersonPreview => Boolean(p)),
  );
}

function bucketPreviewLabel(bucket: InsiderConnectionBucketId, profile: UserConnectionProfile): {
  title: string;
  subtitle: string;
  theme: InsiderConnectionBucket["theme"];
} {
  switch (bucket) {
    case "decision_makers":
      return {
        title: "Decision makers",
        subtitle: "Likely hiring managers & leaders for this role",
        theme: "green",
      };
    case "team":
      return {
        title: "On this team",
        subtitle: "People associated with the hiring team",
        theme: "teal",
      };
    case "past_companies": {
      const label = profile.pastCompanyLabels[0];
      return {
        title: "From your previous company",
        subtitle: label ? `Previously @ ${label}${profile.pastCompanyLabels.length > 1 ? " and others" : ""}` : "Add work history on Profile to match ex-colleagues",
        theme: "blue",
      };
    }
    case "school": {
      const label = profile.schoolLabels[0];
      return {
        title: "From your school",
        subtitle: label ? `@ ${label}${profile.schoolLabels.length > 1 ? " and others" : ""}` : "Add education on Profile to match alumni",
        theme: "purple",
      };
    }
  }
}

function buildBucket(
  id: InsiderConnectionBucketId,
  people: SumblePersonPreview[],
  profile: UserConnectionProfile,
  job: InsiderConnectionsJobContext,
  linkedinSearchUrl: string,
): InsiderConnectionBucket {
  const meta = bucketPreviewLabel(id, profile);
  const total = people.length;
  const preview = people.slice(0, 5);
  return {
    id,
    title: meta.title,
    subtitle: meta.subtitle,
    theme: meta.theme,
    people: preview,
    linkedinSearchUrl,
    totalCount: Math.max(total, preview.length),
  };
}

async function resolveOrgIds(names: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!names.length) return map;

  for (const name of names.slice(0, 5)) {
    const res = await sumblePost<SumbleOrgsResponse>("/v6/organizations", {
      organizations: [{ name: name.trim() }],
      select: { attributes: ["id", "name"] },
    });
    if (res.ok) {
      const id = res.data.organizations?.[0]?.attributes?.id;
      if (typeof id === "number") map.set(name, id);
    }
  }
  return map;
}

async function findPeopleFromPastOrgs(
  targetOrgId: number,
  orgNames: string[],
  orgLabels: string[],
): Promise<SumblePersonPreview[]> {
  if (!orgNames.length) return [];

  const orgMap = await resolveOrgIds(orgNames);
  if (!orgMap.size) return [];

  const targetPeople = await fetchOrgPeoplePreview(targetOrgId, 50, 0, null);
  if (!targetPeople.length) return [];

  const targetNameSet = new Set(targetPeople.map((p) => p.name.toLowerCase()));

  const matched: SumblePersonPreview[] = [];
  const seenNames = new Set<string>();

  for (const [name, pastOrgId] of orgMap) {
    if (pastOrgId === targetOrgId) continue;
    const pastOrgPeople = await fetchOrgPeoplePreview(pastOrgId, 30, 0, null);
    for (const person of pastOrgPeople) {
      const key = person.name.toLowerCase();
      if (targetNameSet.has(key) && !seenNames.has(key)) {
        seenNames.add(key);
        matched.push({ ...person, contextLabel: `Previously @ ${name}` });
        if (matched.length >= 6) return matched;
      }
    }
  }

  return matched;
}

export async function loadInsiderConnections(input: {
  job: InsiderConnectionsJobContext;
  profile: UserConnectionProfile;
}): Promise<InsiderConnectionsResult> {
  const { job, profile } = input;
  const companyName = job.companyName.trim();

  const orgId = await resolveSumbleOrganizationId(job);
  if (!orgId) {
    return {
      configured: true,
      companyName,
      sumbleOrganizationId: null,
      buckets: [],
      error: "Could not match this company in Sumble — try again later.",
    };
  }

  const { people: decisionPeople, teamIds, teamName } = await fetchJobRelatedPeople(orgId, job.jobTitle);
  const teamPeople = await fetchTeamPeople(teamIds.length ? teamIds : []);

  const pastPeople = await findPeopleFromPastOrgs(orgId, profile.pastCompanies, profile.pastCompanyLabels);
  const schoolPeople = await findPeopleFromPastOrgs(orgId, profile.schools, profile.schoolLabels);

  const buckets: InsiderConnectionBucket[] = [
    buildBucket(
      "decision_makers",
      decisionPeople,
      profile,
      job,
      buildDecisionMakerLinkedInUrl(companyName, job.jobTitle),
    ),
    buildBucket(
      "team",
      teamPeople.length ? teamPeople : decisionPeople.slice(0, 5),
      profile,
      job,
      buildTeamLinkedInUrl(companyName, teamName ?? job.jobTeam ?? null, job.jobTitle),
    ),
    buildBucket(
      "past_companies",
      pastPeople,
      profile,
      job,
      buildPastCompanyLinkedInUrl(companyName, profile.pastCompanies),
    ),
    buildBucket(
      "school",
      schoolPeople,
      profile,
      job,
      profile.schools[0]
        ? buildSchoolLinkedInUrl(companyName, profile.schools[0])
        : buildSchoolLinkedInUrl(companyName, "alumni"),
    ),
  ];

  return {
    configured: true,
    companyName,
    sumbleOrganizationId: orgId,
    buckets,
    error: null,
  };
}

export async function revealEmailByLinkedIn(linkedinUrl: string): Promise<{
  ok: boolean;
  email?: string | null;
  name?: string | null;
  title?: string | null;
  error?: string;
}> {
  const res = await sumblePost<SumblePeopleResponse>("/v6/people", {
    people: [{ linkedin_url: linkedinUrl }],
    select: {
      attributes: ["name", "job_title", "email", "linkedin_url"],
    },
  });

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  const row = res.data.people?.[0];
  const email = row?.attributes?.email?.trim() ?? null;
  return {
    ok: true,
    email,
    name: row?.attributes?.name?.trim() ?? null,
    title: row?.attributes?.job_title?.trim() ?? null,
  };
}
