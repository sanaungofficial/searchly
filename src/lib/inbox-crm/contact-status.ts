/** Canonical lead statuses (stored on write; legacy values mapped on read). */
export type InboxContactStatus =
  | "new"
  | "in_conversation"
  | "meeting_scheduled"
  | "archived";

/** Legacy DB values — mapped to canonical statuses in the read layer. */
export type LegacyInboxContactStatus =
  | "outreach"
  | "replied"
  | "meeting"
  | "active"
  | "not_interested"
  | "on_hold";

export type ContactStatusMeta = {
  id: InboxContactStatus;
  label: string;
  emoji: string;
  dot: string;
  bg: string;
  color: string;
};

export const INBOX_CONTACT_STATUSES: ContactStatusMeta[] = [
  { id: "new", label: "New", emoji: "🆕", dot: "#8B5CF6", bg: "rgba(139,92,246,0.12)", color: "#5B21B6" },
  {
    id: "in_conversation",
    label: "In conversation",
    emoji: "💬",
    dot: "#3B82F6",
    bg: "rgba(59,130,246,0.12)",
    color: "#1D4ED8",
  },
  {
    id: "meeting_scheduled",
    label: "Meeting scheduled",
    emoji: "📅",
    dot: "#EAB308",
    bg: "rgba(234,179,8,0.14)",
    color: "#A16207",
  },
  {
    id: "archived",
    label: "Archived",
    emoji: "📦",
    dot: "#9CA3AF",
    bg: "rgba(156,163,175,0.18)",
    color: "#4B5563",
  },
];

export const DEFAULT_CONTACT_STATUS: InboxContactStatus = "new";

const LEGACY_TO_CANONICAL: Record<string, InboxContactStatus> = {
  new: "new",
  outreach: "in_conversation",
  replied: "in_conversation",
  active: "in_conversation",
  meeting: "meeting_scheduled",
  not_interested: "archived",
  on_hold: "archived",
  in_conversation: "in_conversation",
  meeting_scheduled: "meeting_scheduled",
  archived: "archived",
};

const CANONICAL_TO_LEGACY: Record<InboxContactStatus, string[]> = {
  new: ["new"],
  in_conversation: ["in_conversation", "outreach", "replied", "active"],
  meeting_scheduled: ["meeting_scheduled", "meeting"],
  archived: ["archived", "not_interested", "on_hold"],
};

/** Map any stored status (legacy or canonical) to a canonical status for display and counts. */
export function normalizeContactStatus(value: string | null | undefined): InboxContactStatus {
  if (!value?.trim()) return DEFAULT_CONTACT_STATUS;
  return LEGACY_TO_CANONICAL[value.trim()] ?? DEFAULT_CONTACT_STATUS;
}

/** DB status values that belong to a canonical status (for filters). */
export function dbStatusesForCanonical(status: InboxContactStatus): string[] {
  return CANONICAL_TO_LEGACY[status] ?? [status];
}

export function isInboxContactStatus(value: unknown): value is InboxContactStatus {
  return INBOX_CONTACT_STATUSES.some((s) => s.id === value);
}

export function contactStatusMeta(status: string | null | undefined): ContactStatusMeta {
  const canonical = normalizeContactStatus(status);
  return INBOX_CONTACT_STATUSES.find((s) => s.id === canonical) ?? INBOX_CONTACT_STATUSES[0];
}
