import type { InboxActivityCategory, InboxActivityDirection } from "@prisma/client";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { isInboxUserTag } from "@/lib/email-sender-display";

export type MessageActivityMeta = {
  id: string;
  category: InboxActivityCategory | string;
  direction: InboxActivityDirection | string;
  userTag: InboxUserTag | null;
  contact: { id: string; email: string; name: string | null; company: string | null } | null;
  job: { id: string; company: string; role: string; stage: string } | null;
  /** @deprecated Use category — kept for pill fallback during migration */
  signal?: string | null;
};

export function serializeMessageActivity(
  activity:
    | {
        id: string;
        category: InboxActivityCategory | string;
        direction: InboxActivityDirection | string;
        userTag: string | null;
        contact: { id: string; email: string; name: string | null; company: string | null } | null;
        job: { id: string; company: string; role: string; stage: string } | null;
      }
    | null
    | undefined,
): MessageActivityMeta | null {
  if (!activity) return null;
  return {
    id: activity.id,
    category: activity.category,
    direction: activity.direction,
    userTag: isInboxUserTag(activity.userTag) ? activity.userTag : null,
    contact: activity.contact,
    job: activity.job,
    signal: categoryToLegacySignal(activity.category),
  };
}

function categoryToLegacySignal(category: string): string | null {
  switch (category) {
    case "RECRUITER":
      return "RECRUITER_OUTREACH";
    case "JOB_SEARCH":
      return "FOLLOW_UP";
    default:
      return null;
  }
}
