export type InboxContactStatus =
  | "new"
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
  { id: "outreach", label: "Outreach sent", emoji: "📤", dot: "#3B82F6", bg: "rgba(59,130,246,0.12)", color: "#1D4ED8" },
  { id: "replied", label: "Replied", emoji: "💬", dot: "#22C55E", bg: "rgba(34,197,94,0.12)", color: "#15803D" },
  { id: "meeting", label: "Meeting scheduled", emoji: "📅", dot: "#EAB308", bg: "rgba(234,179,8,0.14)", color: "#A16207" },
  { id: "active", label: "Active", emoji: "🤝", dot: "#14B8A6", bg: "rgba(20,184,166,0.12)", color: "#0F766E" },
  { id: "not_interested", label: "Not interested", emoji: "🚫", dot: "#9CA3AF", bg: "rgba(156,163,175,0.18)", color: "#4B5563" },
  { id: "on_hold", label: "On hold", emoji: "⏸", dot: "#F97316", bg: "rgba(249,115,22,0.12)", color: "#C2410C" },
];

export const DEFAULT_CONTACT_STATUS: InboxContactStatus = "new";

export function isInboxContactStatus(value: unknown): value is InboxContactStatus {
  return INBOX_CONTACT_STATUSES.some((s) => s.id === value);
}

export function contactStatusMeta(status: string | null | undefined): ContactStatusMeta {
  return INBOX_CONTACT_STATUSES.find((s) => s.id === status) ?? INBOX_CONTACT_STATUSES[0];
}
