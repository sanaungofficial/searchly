import { InboxActivityCategory, InboxActivityKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { categorizeInboxMail } from "@/lib/inbox-crm/categorize";
import { normalizeContactStatus } from "@/lib/inbox-crm/contact-status";
import { companyFromEmailDomain } from "@/lib/org-contact-graph/normalize-email";
import { domainFromUrl } from "@/lib/sumble/client";
import { normalizeTargetCompanyKey } from "@/lib/org-network-match";

const JUNK_CATEGORIES = new Set<InboxActivityCategory>([
  InboxActivityCategory.NEWSLETTER,
  InboxActivityCategory.AUTOMATED,
]);

const BLOCKED_LOCAL_PARTS = new Set([
  "info",
  "noreply",
  "no-reply",
  "hello",
  "support",
  "team",
  "contact",
  "admin",
  "help",
  "sales",
  "marketing",
  "newsletter",
  "news",
  "notifications",
  "notify",
  "billing",
  "accounts",
  "account",
  "careers",
  "jobs",
  "hr",
  "hiring",
  "talent",
  "recruiting",
  "updates",
  "mailer",
  "postmaster",
  "daemon",
  "donotreply",
  "do-not-reply",
  "feedback",
  "office",
  "enquiries",
  "inquiries",
  "service",
  "mail",
  "email",
]);

const ROLE_NAME_PATTERNS = [
  /^support(\s|$)/i,
  /^team(\s|$)/i,
  /^info(\s|$)/i,
  /^customer(\s|$)/i,
  /^hr(\s|$)/i,
  /^recruiting(\s|$)/i,
  /^talent(\s|$)/i,
  /^careers(\s|$)/i,
  /^noreply(\s|$)/i,
  /^no-reply(\s|$)/i,
];

export type InboxContactSuggestion = {
  contactId: string;
  email: string;
  name: string;
  company: string | null;
  reason: string;
  score: number;
  lastActivityAt: string | null;
  activityPreview: string;
};

function domainKey(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return domain.replace(/^www\./, "");
}

function isBlockedLocalPart(localPart: string): boolean {
  const lower = localPart.toLowerCase();
  if (BLOCKED_LOCAL_PARTS.has(lower)) return true;
  for (const blocked of BLOCKED_LOCAL_PARTS) {
    if (lower.startsWith(`${blocked}+`) || lower.startsWith(`${blocked}.`) || lower.startsWith(`${blocked}_`)) {
      return true;
    }
  }
  return false;
}

/** Require a real person name — not generic mailboxes or role accounts. */
export function isHumanInboxContact(email: string, name: string | null | undefined): boolean {
  const localPart = email.split("@")[0]?.trim().toLowerCase() ?? "";
  if (!localPart || isBlockedLocalPart(localPart)) return false;

  const trimmedName = name?.trim();
  if (!trimmedName || trimmedName.includes("@")) return false;
  if (ROLE_NAME_PATTERNS.some((p) => p.test(trimmedName))) return false;

  const parts = trimmedName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;

  if (parts.length === 1) {
    const word = parts[0]!.toLowerCase();
    if (BLOCKED_LOCAL_PARTS.has(word)) return false;
    if (/^(support|team|info|admin|careers|recruiting|hello)$/i.test(word)) return false;
    return word.length >= 2;
  }

  return parts.length >= 2 && parts.every((p) => p.length >= 1);
}

function formatActivityDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function buildActivityPreview(params: {
  kind: InboxActivityKind;
  subject?: string | null;
  occurredAt?: Date | string | null;
}): string {
  const dateStr = formatActivityDate(
    params.occurredAt instanceof Date ? params.occurredAt.toISOString() : (params.occurredAt ?? null),
  );
  const subject = params.subject?.trim();

  if (params.kind === InboxActivityKind.MEETING) {
    const title = subject || "Meeting";
    return dateStr ? `Meeting on ${dateStr}: ${title}` : `Meeting: ${title}`;
  }

  if (subject) {
    return dateStr ? `Recent email thread — ${subject} (${dateStr})` : `Recent email thread — ${subject}`;
  }

  return dateStr ? `Recent inbox activity (${dateStr})` : "Recent inbox conversation";
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

/** Rule-based: recent inbox participants that look human and match target employers or pipeline companies. */
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
    if (normalizeContactStatus(contact.status) === "archived") continue;
    if (!isHumanInboxContact(contact.email, contact.name)) continue;

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
    } else if (activity.kind === InboxActivityKind.MEETING) {
      reason = "Recent meeting";
    }

    const activityPreview = buildActivityPreview({
      kind: activity.kind,
      subject: activity.subject,
      occurredAt: activity.occurredAt,
    });

    const displayName = contact.name!.trim();
    const occurredAt = activity.occurredAt?.toISOString() ?? null;

    const existing = byContact.get(contact.id);
    if (!existing || score > existing.score) {
      byContact.set(contact.id, {
        contactId: contact.id,
        email: contact.email,
        name: displayName,
        company: contact.company,
        reason,
        score,
        lastActivityAt: occurredAt,
        activityPreview,
      });
    } else if (existing && occurredAt && (!existing.lastActivityAt || occurredAt > existing.lastActivityAt)) {
      existing.lastActivityAt = occurredAt;
      existing.activityPreview = activityPreview;
    }
  }

  return [...byContact.values()]
    .sort((a, b) => b.score - a.score || (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""))
    .slice(0, limit);
}
