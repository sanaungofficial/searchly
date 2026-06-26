import type { InboxWisdomTip } from "@/lib/inbox-wisdom-tips";

export const INBOX_WORK_WISDOM_TIPS: InboxWisdomTip[] = [
  {
    id: "client-updates",
    title: "Client updates first",
    body: "When someone asks to change their profile, resume, or target list — save it to their record before you reply.",
  },
  {
    id: "prospect-replies",
    title: "Prospects need a fast yes/no",
    body: "Discovery and intro emails deserve a same-day reply, even if it's just scheduling time.",
  },
  {
    id: "attach-to-client",
    title: "Link mail to the right person",
    body: "If you're not sure who it's from, match the sender to a client before filing the thread.",
  },
  {
    id: "coach-notes",
    title: "Log what you promised",
    body: "After a client call or long email thread, add a short note on their profile so nothing slips.",
  },
];

export function pickWorkWisdomTips(count: number, seed = new Date().getDate()): InboxWisdomTip[] {
  const start = seed % INBOX_WORK_WISDOM_TIPS.length;
  const tips: InboxWisdomTip[] = [];
  for (let i = 0; i < Math.min(count, INBOX_WORK_WISDOM_TIPS.length); i++) {
    tips.push(INBOX_WORK_WISDOM_TIPS[(start + i) % INBOX_WORK_WISDOM_TIPS.length]);
  }
  return tips;
}
