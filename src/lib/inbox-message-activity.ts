import { JobActivitySignal, JobActivityStatus } from "@prisma/client";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { userTagFromRawPayload } from "@/lib/email-sender-display";

export type MessageActivityMeta = {
  id: string;
  signal: JobActivitySignal | string;
  status: JobActivityStatus | string;
  userTag: InboxUserTag | null;
  companyGuess: string | null;
  roleGuess: string | null;
  job: { id: string; company: string; role: string; stage: string } | null;
};

export function serializeMessageActivity(
  activity: {
    id: string;
    signal: JobActivitySignal | string;
    status: JobActivityStatus | string;
    companyGuess: string | null;
    roleGuess: string | null;
    rawPayload: unknown;
    job: { id: string; company: string; role: string; stage: string } | null;
  } | null | undefined,
): MessageActivityMeta | null {
  if (!activity) return null;
  return {
    id: activity.id,
    signal: activity.signal,
    status: activity.status,
    userTag: userTagFromRawPayload(activity.rawPayload),
    companyGuess: activity.companyGuess,
    roleGuess: activity.roleGuess,
    job: activity.job,
  };
}
