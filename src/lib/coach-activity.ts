import type { HubCommunication } from "@/lib/coach-hub";

export type CoachActivityKind = "booked" | "rescheduled" | "cancelled" | "assigned";

export function coachActivityKind(type: HubCommunication["type"]): CoachActivityKind | null {
  switch (type) {
    case "GUEST_CONFIRMATION":
    case "SESSION_BOOKED":
      return "booked";
    case "SESSION_RESCHEDULED":
      return "rescheduled";
    case "CANCELLATION":
    case "SESSION_CANCELLED":
      return "cancelled";
    case "COACH_ASSIGNED":
      return "assigned";
    default:
      return null;
  }
}

/** One timeline row per booking lifecycle event (stored email log wins over synthetic). */
export function dedupeCoachCommunications(rows: HubCommunication[]): HubCommunication[] {
  const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seen = new Set<string>();
  const result: HubCommunication[] = [];

  for (const row of sorted) {
    const kind = coachActivityKind(row.type);
    const key = kind && row.bookingId ? `${row.bookingId}:${kind}` : kind === "assigned" ? row.id : row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
}

export function formatCoachActivityLabel(type: HubCommunication["type"]): string {
  switch (type) {
    case "GUEST_CONFIRMATION":
      return "Session confirmed";
    case "COACH_NOTIFICATION":
      return "Coach notified";
    case "CANCELLATION":
    case "SESSION_CANCELLED":
      return "Session cancelled";
    case "SESSION_BOOKED":
      return "Session booked";
    case "SESSION_RESCHEDULED":
      return "Session rescheduled";
    case "COACH_ASSIGNED":
      return "Coach matched";
    default:
      return "Update";
  }
}

export function formatCoachActivityWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}
