export type ApplicationQaSuggestion = {
  question: string;
  answer: string;
  tags: string[];
};

/** Curated common application questions with starter answers coaches can customize. */
export const APPLICATION_QA_SUGGESTIONS: ApplicationQaSuggestion[] = [
  {
    question: "Why do you want to work here?",
    answer:
      "I'm drawn to [Company] because of [specific product, mission, or market position]. What stands out is [concrete reason — culture, growth, technical challenge, or customer impact]. My background in [relevant area] aligns with where the team is headed, and I'd love to contribute to [specific goal or initiative].",
    tags: ["motivation"],
  },
  {
    question: "Why are you interested in this role?",
    answer:
      "This role sits at the intersection of what I do best — [core strengths] — and what I want to grow in — [growth area]. The responsibilities around [key responsibility] match my recent work at [employer/context], and I'm excited to take on [specific aspect of the role] at a company where [brief tie to company].",
    tags: ["motivation"],
  },
  {
    question: "Tell us about yourself",
    answer:
      "I'm a [role/title] with [X years] of experience in [domain/industry]. Most recently at [company], I [key achievement or responsibility]. I'm known for [strength or approach], and I'm looking for [next step — type of team, challenge, or impact]. Outside of work, [brief personal note if appropriate].",
    tags: ["intro"],
  },
  {
    question: "What is your greatest strength relevant to this role?",
    answer:
      "My greatest strength for this role is [strength]. For example, at [company/situation], I [specific action] which led to [measurable outcome]. I bring this same approach to [how it applies to the target role].",
    tags: ["behavioral"],
  },
  {
    question: "Describe a challenging situation and how you handled it",
    answer:
      "Situation: At [company], we faced [challenge — deadline, conflict, technical blocker, scope change].\n\nTask: I needed to [your responsibility].\n\nAction: I [steps you took — aligned stakeholders, broke down the problem, delegated, escalated, etc.].\n\nResult: We [outcome with numbers or clear impact if possible]. I learned [brief reflection].",
    tags: ["behavioral"],
  },
  {
    question: "What are your salary expectations?",
    answer:
      "Based on my experience, the scope of this role, and market rates for [role level] in [location/market], I'm targeting [range or target]. I'm open to discussing the full package — base, bonus, equity, and benefits — to find something that works for both sides.",
    tags: ["logistics"],
  },
  {
    question: "What is your work authorization / visa status?",
    answer:
      "[Choose one and customize: I am authorized to work in [country] without restriction. / I will require [visa type] sponsorship. / My current authorization is [status] and expires [date]; I am [eligible / pursuing] sponsorship if needed.]",
    tags: ["logistics"],
  },
  {
    question: "When can you start?",
    answer:
      "I can start [immediately / after a standard notice period of X weeks / on a specific date]. If the team needs flexibility, I'm happy to discuss a transition timeline that works for everyone.",
    tags: ["logistics"],
  },
  {
    question: "Why are you leaving your current role?",
    answer:
      "I've learned a lot at [current/previous company], especially around [growth area]. I'm now looking for [what's next — larger scope, different domain, mission alignment, leadership step, etc.]. This opportunity at [Company] is a strong fit because [specific, positive reason — not criticism of current employer].",
    tags: ["motivation"],
  },
  {
    question: "Is there anything else we should know?",
    answer:
      "A few things that might be helpful: [optional — relocation openness, side projects relevant to the role, non-traditional background, scheduling constraints, or enthusiasm for a specific part of the role]. I'm happy to elaborate on any of this in conversation.",
    tags: ["other"],
  },
];
