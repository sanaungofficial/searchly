import { prisma } from "@/lib/prisma";
import { domainFromUrl, isSumbleConfigured, sumblePost } from "@/lib/sumble/client";

type SumbleOrgRow = {
  attributes?: { id?: number | null; name?: string | null } | null;
};

type SumbleOrgsResponse = {
  organizations?: SumbleOrgRow[];
};

type SumblePersonRow = {
  attributes?: {
    name?: string | null;
    job_title?: string | null;
    linkedin_url?: string | null;
  } | null;
};

type SumblePeopleResponse = {
  people?: SumblePersonRow[];
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function resolveSumbleOrganizationId(companyName: string, website: string | null): Promise<number | null> {
  const domain = domainFromUrl(website);
  const res = await sumblePost<SumbleOrgsResponse>("/v6/organizations", {
    organizations: [{ name: companyName.trim(), url: domain ?? undefined }],
    select: { attributes: ["id", "name", "url"] },
  });
  if (!res.ok) return null;
  const id = res.data.organizations?.[0]?.attributes?.id;
  return typeof id === "number" ? id : null;
}

function pickBestPersonMatch(
  people: SumblePersonRow[],
  contactName: string | null,
): { linkedinUrl: string | null; title: string | null } | null {
  const target = contactName ? normalizeName(contactName) : null;
  let best: SumblePersonRow | null = null;

  for (const row of people) {
    const name = row.attributes?.name?.trim();
    if (!name) continue;
    if (target && normalizeName(name) !== target) continue;
    if (!row.attributes?.linkedin_url?.trim()) continue;
    best = row;
    if (target) break;
  }

  if (!best && !target) {
    best =
      people.find((row) => row.attributes?.linkedin_url?.trim()) ??
      null;
  }

  if (!best) return null;
  return {
    linkedinUrl: best.attributes?.linkedin_url?.trim() ?? null,
    title: best.attributes?.job_title?.trim() ?? null,
  };
}

export async function enrichOrgContactWithSumble(params: {
  orgId: string;
  contactId: string;
}): Promise<
  | { ok: true; contact: { id: string; name: string | null; company: string | null; title: string | null; linkedinUrl: string | null } }
  | { ok: false; error: string }
> {
  if (!isSumbleConfigured()) {
    return { ok: false, error: "Sumble is not configured on this environment." };
  }

  const contact = await prisma.orgContact.findFirst({
    where: { id: params.contactId, orgId: params.orgId },
  });
  if (!contact) return { ok: false, error: "Contact not found." };

  const companyName = contact.company?.trim();
  if (!companyName) {
    return { ok: false, error: "Contact has no company — add company from inbox sync or edit first." };
  }

  const orgId = await resolveSumbleOrganizationId(companyName, null);
  if (!orgId) {
    return { ok: false, error: `Could not resolve Sumble organization for "${companyName}".` };
  }

  const res = await sumblePost<SumblePeopleResponse>("/v6/people", {
    filter: { organization_ids: [orgId] },
    limit: 25,
    select: {
      attributes: ["name", "job_title", "linkedin_url"],
    },
  });

  if (!res.ok) {
    return { ok: false, error: res.error || "Sumble people lookup failed." };
  }

  const match = pickBestPersonMatch(res.data.people ?? [], contact.name);
  if (!match?.linkedinUrl && !match?.title) {
    return { ok: false, error: "No Sumble profile match found for this contact." };
  }

  const updated = await prisma.orgContact.update({
    where: { id: contact.id },
    data: {
      linkedinUrl: match.linkedinUrl ?? contact.linkedinUrl,
      title: match.title ?? contact.title,
    },
    select: { id: true, name: true, company: true, title: true, linkedinUrl: true },
  });

  return { ok: true, contact: updated };
}
