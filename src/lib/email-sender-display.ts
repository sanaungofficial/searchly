import { createHash } from "crypto";

const PERSONAL_EMAIL_DOMAINS = new Set([
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

export type SenderAvatarUrls = {
  primary: string | null;
  fallback: string | null;
  initials: string;
  displayName: string;
  email: string | null;
  domain: string | null;
};

export function parseSenderFromLine(fromLine: string, fromEmail?: string | null): {
  displayName: string;
  email: string | null;
} {
  const email =
    fromEmail?.trim().toLowerCase() ||
    fromLine.match(/<([^>]+@[^>]+)>/)?.[1]?.trim().toLowerCase() ||
    (fromLine.includes("@") && !fromLine.includes(" ") ? fromLine.trim().toLowerCase() : null);

  const nameMatch = fromLine.match(/^(.+?)\s*<[^>]+>/);
  const displayName =
    nameMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ||
    email?.split("@")[0]?.replace(/[._-]/g, " ") ||
    fromLine.trim() ||
    "Unknown";

  return { displayName, email };
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function gravatarUrl(email: string): string {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=128&d=404`;
}

function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function buildSenderAvatarUrls(fromLine: string, fromEmail?: string | null): SenderAvatarUrls {
  const { displayName, email } = parseSenderFromLine(fromLine, fromEmail);
  const domain = email?.split("@")[1]?.toLowerCase() ?? null;
  const initials = initialsFor(displayName);

  if (!email) {
    return { primary: null, fallback: null, initials, displayName, email: null, domain: null };
  }

  const gravatar = gravatarUrl(email);
  const isPersonal = domain ? PERSONAL_EMAIL_DOMAINS.has(domain) : true;

  if (domain && !isPersonal) {
    return {
      primary: faviconUrl(domain),
      fallback: gravatar,
      initials,
      displayName,
      email,
      domain,
    };
  }

  return {
    primary: gravatar,
    fallback: null,
    initials,
    displayName,
    email,
    domain,
  };
}

export type InboxUserTag = "needs_follow_up" | "answered" | "potential" | "waiting";

export const INBOX_USER_TAGS: { id: InboxUserTag; label: string; emoji: string }[] = [
  { id: "needs_follow_up", label: "Follow up", emoji: "↩" },
  { id: "potential", label: "Potential", emoji: "✦" },
  { id: "waiting", label: "Waiting", emoji: "⏳" },
  { id: "answered", label: "Answered", emoji: "✓" },
];

export function userTagFromRawPayload(raw: unknown): InboxUserTag | null {
  if (!raw || typeof raw !== "object") return null;
  const tag = (raw as { userTag?: string }).userTag;
  if (tag === "needs_follow_up" || tag === "answered" || tag === "potential" || tag === "waiting") {
    return tag;
  }
  return null;
}

export function signalStatusLabel(signal: string): { label: string; tone: "green" | "amber" | "red" | "blue" | "neutral" } {
  switch (signal) {
    case "INTERVIEW_INVITE":
      return { label: "Interview", tone: "green" };
    case "OFFER":
      return { label: "Offer", tone: "green" };
    case "RECRUITER_OUTREACH":
      return { label: "Recruiter", tone: "blue" };
    case "FOLLOW_UP":
      return { label: "Needs reply", tone: "amber" };
    case "APPLICATION_RECEIVED":
      return { label: "Application", tone: "neutral" };
    case "REJECTION":
      return { label: "Closed", tone: "red" };
    default:
      return { label: "Update", tone: "neutral" };
  }
}

export function userTagStyle(tag: InboxUserTag): { label: string; tone: "green" | "amber" | "red" | "blue" | "neutral" } {
  switch (tag) {
    case "needs_follow_up":
      return { label: "Follow up", tone: "amber" };
    case "potential":
      return { label: "Potential", tone: "blue" };
    case "waiting":
      return { label: "Waiting", tone: "neutral" };
    case "answered":
      return { label: "Answered", tone: "green" };
  }
}
