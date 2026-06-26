import type { AssistantInboxSnapshot, AssistantSuggestion } from "@/lib/kimchi-assistant/types";

type InboxActivity = AssistantInboxSnapshot["activities"][number];

const PROMO_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bnewsletter\b/i,
  /\bemail preferences\b/i,
  /\bno longer wish to receive\b/i,
  /\bmarketing\b/i,
  /\bpromotional\b/i,
  /\bjob (?:alert )?digest\b/i,
  /\blinkedin.*(?:digest|recommended jobs)\b/i,
  /\b(?:applied to|you applied to) \d{2,}\+?\s*jobs?\b/i,
  /\bi applied to \d+\+?\s*jobs?\b/i,
  /\bziprecruiter\b/i,
  /\bindeed (?:alert|digest)\b/i,
  /\bglassdoor\b.*\bdigest\b/i,
  /\bjob blast\b/i,
  /\bmass apply\b/i,
  /\bweekly (?:job|career) (?:roundup|round-up|update)\b/i,
];

/** Skip marketing / bulk job-blast emails that aren't actionable job-search signals. */
export function isPromotionalInboxActivity(a: Pick<InboxActivity, "title" | "snippet" | "signal" | "confidence">): boolean {
  const text = `${a.title ?? ""} ${a.snippet ?? ""}`;
  if (PROMO_PATTERNS.some((re) => re.test(text))) return true;
  if (a.signal === "OTHER" && (a.confidence ?? 0.5) < 0.55) return true;
  return false;
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function parseRoleCompanyFromDetail(detail: string): { role?: string; company?: string } {
  const atMatch = detail.match(/^(.+?) at (.+?)(?:\s*\(|$)/);
  if (atMatch) return { role: atMatch[1]?.trim(), company: atMatch[2]?.trim() };
  return {};
}

function parseInterviewPrep(s: AssistantSuggestion): { role: string; company: string } | null {
  const m = s.title.match(/^Prep for (.+?) interview$/i);
  if (m?.[1]) {
    const fromDetail = parseRoleCompanyFromDetail(s.detail);
    return {
      role: m[1].trim(),
      company: fromDetail.company ?? "that company",
    };
  }
  return null;
}

function parseStrongFit(s: AssistantSuggestion): { role: string; company: string; fit?: number } | null {
  const m = s.title.match(/^Strong fit: (.+)$/i);
  if (!m?.[1]) return null;
  const role = m[1].trim();
  const fromDetail = parseRoleCompanyFromDetail(s.detail);
  const fitMatch = s.detail.match(/(\d{1,3})%\s*match/i);
  return {
    role,
    company: fromDetail.company ?? "that company",
    fit: fitMatch ? Number(fitMatch[1]) : undefined,
  };
}

function parseFollowUp(s: AssistantSuggestion): { role: string; company: string } | null {
  const m = s.title.match(/^Follow up on (.+)$/i);
  if (m?.[1]) {
    const fromDetail = parseRoleCompanyFromDetail(s.detail.split(";")[0] ?? s.detail);
    return { role: m[1].trim(), company: fromDetail.company ?? "that company" };
  }
  return null;
}

function inboxQuestion(
  a: Pick<InboxActivity, "title" | "snippet" | "signal" | "companyGuess" | "roleGuess">,
): { label: string; prompt: string } {
  const company = a.companyGuess?.trim() || "this company";
  const role = a.roleGuess?.trim();
  const subject = a.title?.trim();

  switch (a.signal) {
    case "INTERVIEW_INVITE":
      return {
        label: truncate(
          role
            ? `How should I prep for my ${role} interview at ${company}?`
            : `How should I respond to the interview invite from ${company}?`,
          78,
        ),
        prompt: role
          ? `I got an interview invite for ${role} at ${company}. How should I prep — what to lead with and what gaps should I address?`
          : `I got an interview invite from ${company}. Help me figure out how to prep and what to ask back.${subject ? ` Subject: ${subject.slice(0, 120)}` : ""}`,
      };
    case "RECRUITER_OUTREACH":
      return {
        label: truncate(
          role
            ? `Should I respond to the ${role} outreach from ${company}?`
            : `Should I respond to the recruiter message from ${company}?`,
          78,
        ),
        prompt: role
          ? `A recruiter reached out about ${role} at ${company}. Should I respond, and if so what should I say?`
          : `Help me decide whether to respond to this recruiter outreach from ${company}.${subject ? ` Subject: ${subject.slice(0, 120)}` : ""}`,
      };
    case "APPLICATION_RECEIVED":
      return {
        label: truncate(
          role
            ? `What does this application update mean for ${role} at ${company}?`
            : `What should I do about this application update from ${company}?`,
          78,
        ),
        prompt: `Help me understand this application update${role ? ` for ${role} at ${company}` : ` from ${company}`} and what I should do next.`,
      };
    case "OFFER":
      return {
        label: truncate(`How should I think through this offer from ${company}?`, 78),
        prompt: `I received an offer from ${company}${role ? ` for ${role}` : ""}. Help me think through how to evaluate it and what to ask before deciding.`,
      };
    case "REJECTION":
      return {
        label: truncate(
          role ? `How should I read this rejection for ${role} at ${company}?` : `How should I read this rejection from ${company}?`,
          78,
        ),
        prompt: `I got a rejection${role ? ` for ${role} at ${company}` : ` from ${company}`}. Help me read it and decide whether there's anything worth following up on.`,
      };
    case "FOLLOW_UP":
      return {
        label: truncate(`Should I follow up on my thread with ${company}?`, 78),
        prompt: `This email from ${company} may need a reply. Help me decide what to say.${subject ? ` Subject: ${subject.slice(0, 120)}` : ""}`,
      };
    default:
      return {
        label: truncate(
          role
            ? `What should I do about this ${role} email from ${company}?`
            : subject && subject.length > 8
              ? `What should I do about: ${subject.slice(0, 42)}${subject.length > 42 ? "…" : ""}?`
              : `What should I do about this job email from ${company}?`,
          78,
        ),
        prompt: `Help me decide what to do about this job-search email${company ? ` from ${company}` : ""}${role ? ` about ${role}` : ""}.${subject ? ` Subject: ${subject.slice(0, 160)}` : ""}`,
      };
  }
}

/** Turn a suggestion into a natural question label + chat prompt. */
export function questionFromSuggestion(
  s: AssistantSuggestion,
  inbox?: AssistantInboxSnapshot | null,
): { label: string; prompt: string } {
  if (s.kind === "inbox_email" && s.meta?.activityId && inbox) {
    const activity = inbox.activities.find((a) => a.id === s.meta?.activityId);
    if (activity) return inboxQuestion(activity);
  }

  if (s.id === "interview-prep") {
    const parsed = parseInterviewPrep(s);
    if (parsed) {
      return {
        label: truncate(`How can I prep for my ${parsed.role} interview at ${parsed.company}?`, 78),
        prompt: `How should I prep for my upcoming interview for ${parsed.role} at ${parsed.company}? What stories should I lead with, and where might I be light?`,
      };
    }
  }

  if (s.id.startsWith("apply-")) {
    const parsed = parseStrongFit(s);
    if (parsed) {
      return {
        label: truncate(`Am I a strong fit for the ${parsed.role} role at ${parsed.company}?`, 78),
        prompt: parsed.fit
          ? `Am I a strong fit for the ${parsed.role} role at ${parsed.company}? I see about ${parsed.fit}% match — walk me through why or why not.`
          : `Am I a strong fit for the ${parsed.role} role at ${parsed.company}? Be honest about strengths and gaps.`,
      };
    }
  }

  if (s.id === "follow-up") {
    const parsed = parseFollowUp(s);
    if (parsed) {
      return {
        label: truncate(`Should I follow up on my ${parsed.role} application at ${parsed.company}?`, 78),
        prompt: `Should I follow up on my ${parsed.role} application at ${parsed.company}? If yes, help me draft something short.`,
      };
    }
    return {
      label: truncate("Should I follow up on any of my applications?", 78),
      prompt: `Which of my applications are worth following up on right now? ${s.detail}`,
    };
  }

  if (s.kind === "follow_up") {
    const parsed = parseRoleCompanyFromDetail(s.detail);
    const role = parsed.role ?? s.title.replace(/^Follow up:\s*/i, "").trim();
    const company = parsed.company ?? "that company";
    return {
      label: truncate(`Should I follow up on ${role} at ${company}?`, 78),
      prompt: `Should I follow up on my ${role} application at ${company}? ${s.detail}`,
    };
  }

  if (s.id === "current-job-fit" || s.title.startsWith("Check fit for ")) {
    const role = s.title.replace(/^Check fit for /i, "").trim();
    const company = s.detail.replace(/^At /i, "").trim() || "this role";
    return {
      label: truncate(`Am I a strong fit for the ${role} role${company !== "this role" ? ` at ${company}` : ""}?`, 78),
      prompt: `Am I a strong fit for the ${role} role${company !== "this role" ? ` at ${company}` : ""}? Be specific about strengths and gaps.`,
    };
  }

  if (s.id === "create-strategy") {
    return {
      label: "Help me build my career strategy",
      prompt: "Help me turn what you know about me into a clear career strategy — target roles, timeline, and priorities.",
    };
  }

  if (s.id === "upload-resume") {
    return {
      label: "What should I fix on my resume first?",
      prompt: "Based on my target roles, what's the first thing I should improve on my resume?",
    };
  }

  if (s.id === "add-jobs") {
    return {
      label: "What kinds of roles should I be tracking?",
      prompt: "Based on my profile and goals, what kinds of roles should I add to my pipeline?",
    };
  }

  if (s.id === "finish-readback") {
    return {
      label: "Help me sharpen how I describe myself",
      prompt: "Help me sharpen how I describe my background — positioning, headline, and proof points.",
    };
  }

  if (s.id === "connect-email") {
    return {
      label: "What can you help with once I connect email?",
      prompt: "If I connect my email, what kinds of job-search updates can you help me with?",
    };
  }

  return {
    label: truncate(s.title.endsWith("?") ? s.title : `${s.title}?`, 78),
    prompt: s.detail ? `${s.title} — ${s.detail}` : s.title,
  };
}

/** Filter suggestions for welcome chips — drop promo inbox, prefer actionable items. */
export function filterSuggestionsForWelcome(
  suggestions: AssistantSuggestion[],
  inbox?: AssistantInboxSnapshot | null,
): AssistantSuggestion[] {
  return suggestions.filter((s) => {
    if (s.kind !== "inbox_email" || !s.meta?.activityId || !inbox) return true;
    const activity = inbox.activities.find((a) => a.id === s.meta?.activityId);
    if (!activity) return false;
    return !isPromotionalInboxActivity(activity);
  });
}
