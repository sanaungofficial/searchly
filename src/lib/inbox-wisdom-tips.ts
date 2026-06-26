export type InboxWisdomTip = {
  id: string;
  title: string;
  body: string;
};

export const INBOX_WISDOM_TIPS: InboxWisdomTip[] = [
  {
    id: "follow-up-timing",
    title: "Follow up with intention",
    body: "If you haven't heard back in a week, a short, polite check-in is fair — reference the role and one thing you still bring to the table.",
  },
  {
    id: "save-everything",
    title: "Save roles as you go",
    body: "When a recruiter reaches out, save the role right away — even if you're not sure yet. It's easier to pass later than to reconstruct the thread.",
  },
  {
    id: "subject-lines",
    title: "Make replies easy to scan",
    body: "Lead with the company and role in your subject line when you reply. Recruiters juggle dozens of threads — help them find yours.",
  },
  {
    id: "thank-you-notes",
    title: "Send thank-you notes",
    body: "After every interview, send a brief thank-you within 24 hours. Mention one specific moment from the conversation — it sticks.",
  },
  {
    id: "pipeline-honesty",
    title: "Keep your list honest",
    body: "Mark roles as applied or interviewing when the email confirms it. A clean list makes follow-ups and prep much easier.",
  },
  {
    id: "not-every-email",
    title: "Not every email is a job",
    body: "Newsletters and networking blasts happen. If something isn't job-related, say so — it helps Kimchi surface what actually matters.",
  },
  {
    id: "prep-before-reply",
    title: "Read before you reply",
    body: "Skim the whole thread before responding to a recruiter. A thoughtful reply beats a fast one when you're negotiating timing or next steps.",
  },
  {
    id: "track-quiet-roles",
    title: "Watch quiet threads",
    body: "Roles that go quiet for two weeks are worth a nudge — or a decision to move on. Either way, don't let them sit in limbo.",
  },
];

/** Stable daily rotation so the strip feels fresh without randomness. */
export function pickWisdomTips(count: number, seed = new Date().getDate()): InboxWisdomTip[] {
  const start = seed % INBOX_WISDOM_TIPS.length;
  const tips: InboxWisdomTip[] = [];
  for (let i = 0; i < Math.min(count, INBOX_WISDOM_TIPS.length); i++) {
    tips.push(INBOX_WISDOM_TIPS[(start + i) % INBOX_WISDOM_TIPS.length]);
  }
  return tips;
}
