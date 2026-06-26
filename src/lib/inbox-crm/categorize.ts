import { InboxActivityCategory } from "@prisma/client";

const NEWSLETTER_PATTERNS = [
  /newsletter/i,
  /unsubscribe/i,
  /mailchimp/i,
  /substack/i,
  /list-unsubscribe/i,
  /digest@/i,
  /noreply@/i,
  /no-reply@/i,
];

const AUTOMATED_PATTERNS = [
  /notifications?@/i,
  /notify@/i,
  /daemon@/i,
  /donotreply@/i,
  /mailer-daemon/i,
  /postmaster@/i,
  /automated@/i,
  /support@.*\.(google|microsoft|apple|amazon)\./i,
];

const RECRUITER_PATTERNS = [
  /recruiter/i,
  /talent@/i,
  /hiring@/i,
  /careers@/i,
  /jobs@/i,
  /people@/i,
  /hr@/i,
  /greenhouse/i,
  /lever\.co/i,
  /workday/i,
  /ashbyhq/i,
];

const JOB_SEARCH_PATTERNS = [
  /interview/i,
  /application/i,
  /job (opportunity|opening|posting)/i,
  /offer letter/i,
  /screening/i,
  /phone screen/i,
  /onsite/i,
  /thank you for applying/i,
  /your application/i,
  /next steps/i,
  /candidate/i,
];

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
]);

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((p) => p.test(text));
}

function domainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.split("@")[1]?.toLowerCase() ?? null;
}

export function categorizeInboxMail(params: {
  fromEmail?: string | null;
  fromName?: string | null;
  subject?: string | null;
  snippet?: string | null;
  headersText?: string | null;
}): InboxActivityCategory {
  const from = `${params.fromName ?? ""} ${params.fromEmail ?? ""}`.trim();
  const haystack = [from, params.subject ?? "", params.snippet ?? "", params.headersText ?? ""]
    .filter(Boolean)
    .join("\n");

  if (matchesAny(haystack, NEWSLETTER_PATTERNS)) return InboxActivityCategory.NEWSLETTER;
  if (matchesAny(haystack, AUTOMATED_PATTERNS)) return InboxActivityCategory.AUTOMATED;
  if (matchesAny(haystack, RECRUITER_PATTERNS)) return InboxActivityCategory.RECRUITER;
  if (matchesAny(haystack, JOB_SEARCH_PATTERNS)) return InboxActivityCategory.JOB_SEARCH;

  const domain = domainFromEmail(params.fromEmail);
  if (domain && PERSONAL_DOMAINS.has(domain)) return InboxActivityCategory.PERSONAL;

  return InboxActivityCategory.UNKNOWN;
}

export function categorizeCalendarEvent(params: {
  title?: string | null;
  description?: string | null;
  participantEmails?: string[];
}): InboxActivityCategory {
  const combined = [params.title ?? "", params.description ?? "", ...(params.participantEmails ?? [])]
    .join("\n")
    .toLowerCase();

  if (/interview|screen|recruiter|hiring|onsite|phone screen|culture fit|meet with/i.test(combined)) {
    return InboxActivityCategory.JOB_SEARCH;
  }

  return InboxActivityCategory.UNKNOWN;
}
