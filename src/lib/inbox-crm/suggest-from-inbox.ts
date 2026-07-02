import { InboxActivityCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { categorizeInboxMail } from "@/lib/inbox-crm/categorize";
import { companyFromEmailDomain } from "@/lib/org-contact-graph/normalize-email";
import { domainFromUrl } from "@/lib/sumble/client";
import { normalizeTargetCompanyKey } from "@/lib/org-network-match";

const JUNK_CATEGORIES = new Set<InboxActivityCategory>([
  InboxActivityCategory.NEWSLETTER,
  InboxActivityCategory.AUTOMATED,
]);

export type InboxContactSuggestion = {
  contactId: string;
  email: string;
  name: string | null;
  company: string | null;
  reason: string;
  score: number;
  lastActivityAt: string | null;
};

function domainKey(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return domain.replace(/^www\./, "");
}

function buildTargetKeys(names: string[], websites: (string | null)[]): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < names.length; i++) {
    keys.add(normalizeTargetCompanyKey(names[i]!, websites[i] ?? null));
    const domain = domainFromUrl(websites[i] ?? null);
    if (domain) keys.add(domain.split(".")[0] ?? domain);
  }
  return keys;
}

function contactMatchesTargets(
  contact: { email: string; company: string | null },
  targetKeys: Set<string>,
): string | null {
  if (targetKeys.size === 0) return null;

  const emailDomain = domainKey(contact.email);
  const emailCompany = companyFromEmailDomain(contact.email);
  const companyLabel = contact.company?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";

  for (const key of targetKeys) {
    if (!key) continue;
    if (emailDomain?.includes(key) || key.includes(emailDomain?.split(".")[0] ?? "")) {
      return `Email domain matches ${key}`;
    }
    if (companyLabel && (companyLabel.includes(key) || key.includes(companyLabel))) {
      return `Company matches ${contact.company ?? key}`;
    }
    if (emailCompany && emailCompany.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(key)) {
      return `Works at ${emailCompany}`;
    }
  }
  return null;
}

/** Rule-based v1: recent inbox participants that look human and match target employers or pipeline companies. */
export async function suggestContactsFromInbox(
  userId: string,
  opts?: { limit?: number },
): Promise<InboxContactSuggestion[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [trackedCompanies, jobs, activities] = await Promise.all([
    prisma.trackedCompany.findMany({
      where: { userId },
      include: { companyIntel: { select: { name: true, website: true } } },
      take: 40,
    }),
    prisma.job.findMany({
      where: { userId, stage: { notIn: ["REJECTED", "WITHDRAWN"] } },
      select: { company: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.inboxActivity.findMany({
      where: {
        userId,
        contactId: { not: null },
        occurredAt: { gte: since },
        category: { notIn: [...JUNK_CATEGORIES] },
      },
      include: {
        contact: {
          select: {
            id: true,
            email: true,
            name: true,
            company: true,
            status: true,
          },
        },
      },
      orderBy: { occurredAt: "desc" },
      take: 300,
    }),
  ]);

  const targetNames = [
    ...trackedCompanies.map((t) => t.companyIntel?.name ?? t.companyId),
    ...jobs.map((j) => j.company),
  ];
  const targetWebsites = trackedCompanies.map((t) => t.companyIntel?.website ?? null);
  const targetKeys = buildTargetKeys(targetNames, targetWebsites);

  const byContact = new Map<string, InboxContactSuggestion>();

  for (const activity of activities) {
    const contact = activity.contact;
    if (!contact) continue;

    const recheck = categorizeInboxMail({
      fromEmail: contact.email,
      fromName: contact.name,
      subject: activity.subject,
      snippet: activity.snippet,
    });
    if (JUNK_CATEGORIES.has(recheck)) continue;

    const targetMatch = contactMatchesTargets(contact, targetKeys);
    const categoryBoost =
      activity.category === InboxActivityCategory.RECRUITER ||
      activity.category === InboxActivityCategory.JOB_SEARCH
        ? 2
        : activity.category === InboxActivityCategory.PERSONAL
          ? 1
          : 0;

    let score = 1 + categoryBoost;
    let reason = "Recent inbox conversation";

    if (targetMatch) {
      score += 4;
      reason = targetMatch;
    } else if (activity.category === InboxActivityCategory.RECRUITER) {
      reason = "Recruiter or hiring contact";
    } else if (activity.category === InboxActivityCategory.JOB_SEARCH) {
      reason = "Job search thread";
    } else if (activity.category === InboxActivityCategory.PERSONAL) {
      reason = "Personal email — possible warm intro";
    }

    const existing = byContact.get(contact.id);
    const occurredAt = activity.occurredAt.toISOString();
    if (!existing || score > existing.score) {
      byContact.set(contact.id, {
        contactId: contact.id,
        email: contact.email,
        name: contact.name,
        company: contact.company,
        reason,
        score,
        lastActivityAt: occurredAt,
      });
    } else if (existing && occurredAt > (existing.lastActivityAt ?? "")) {
      existing.lastActivityAt = occurredAt;
    }
  }

  return [...byContact.values()]
    .sort((a, b) => b.score - a.score || (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""))
    .slice(0, limit);
}
