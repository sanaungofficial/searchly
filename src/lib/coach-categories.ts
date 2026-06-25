/** Coaching category taxonomy for provider onboarding (marketplace + portal). */

export type CoachGoalId = "career" | "school" | "test";

export type CoachGoal = {
  id: CoachGoalId;
  label: string;
  description: string;
  icon: string;
};

export const COACH_GOALS: CoachGoal[] = [
  { id: "career", label: "Build your Career", description: "142 categories", icon: "💼" },
  { id: "school", label: "Get into School", description: "19 categories", icon: "🎓" },
  { id: "test", label: "Take a Test", description: "29 categories", icon: "📋" },
];

export type CoachCategoryGroup = {
  goal: CoachGoalId;
  label: string;
  categories: string[];
};

export const COACH_CATEGORY_GROUPS: CoachCategoryGroup[] = [
  {
    goal: "career",
    label: "General",
    categories: ["Career Coaching", "Executive Coaching", "Life Coaching", "Leadership Coaching"],
  },
  {
    goal: "career",
    label: "Business",
    categories: [
      "Business Operations & Strategy",
      "Human Resources",
      "Marketing",
      "Sales",
      "Consulting",
      "Entrepreneurship",
    ],
  },
  {
    goal: "career",
    label: "Product",
    categories: ["Design", "Product Management", "Technical Program Management", "UX Research"],
  },
  {
    goal: "career",
    label: "AI",
    categories: [
      "AI for Sales & Marketing",
      "AI for Finance",
      "AI Services",
      "Build with AI",
      "AI Fundamentals",
    ],
  },
  {
    goal: "career",
    label: "Development",
    categories: ["Cybersecurity", "Data Science", "Software Engineering", "DevOps & Infrastructure"],
  },
  {
    goal: "career",
    label: "Finance & Accounting",
    categories: ["Accounting", "Investment Banking", "Private Equity", "Venture Capital", "FP&A"],
  },
  {
    goal: "career",
    label: "Law & Public Policy",
    categories: ["Legal Practice", "International Relations", "Public Policy"],
  },
  {
    goal: "school",
    label: "Graduate School",
    categories: ["MBA Admissions", "Law School Admissions", "Medical School Admissions", "PhD Admissions"],
  },
  {
    goal: "school",
    label: "Undergraduate",
    categories: ["College Admissions", "Transfer Admissions", "Financial Aid Strategy"],
  },
  {
    goal: "test",
    label: "Standardized Tests",
    categories: ["GMAT", "GRE", "LSAT", "MCAT", "SAT / ACT"],
  },
];

export const COACH_EXPERIENCE_LEVELS = [
  "Entry-level",
  "Mid-level",
  "Senior",
  "Executive",
  "C-suite",
] as const;

export type CoachExperienceLevel = (typeof COACH_EXPERIENCE_LEVELS)[number];

export const COACH_CLIENT_TIERS = [
  { id: "new", label: "Just getting started", hint: "Haven't coached anyone yet." },
  { id: "beginner", label: "I'm a new coach", hint: "Between 1–10 people coached." },
  { id: "some", label: "I've done some coaching", hint: "Between 11–25 people coached." },
  { id: "experienced", label: "I'm an experienced coach", hint: "Between 26–99 people coached." },
  { id: "expert", label: "I'm an expert", hint: "More than 100 people coached." },
] as const;

export type CoachClientTierId = (typeof COACH_CLIENT_TIERS)[number]["id"];

export const COACH_EXPERTISE_BY_CATEGORY: Record<string, string[]> = {
  "AI for Sales & Marketing": [
    "Ad Copywriting",
    "AI Agents",
    "AI Automation",
    "AI Fundamentals",
    "CRM Automation",
    "Email Marketing Automation",
    "Lead Generation & Scoring",
    "Marketing Analytics",
    "Outbound Automation",
    "Personalization & Segmentation",
    "SEO & Content Marketing",
  ],
  "Career Coaching": [
    "Interview Prep",
    "Resume & LinkedIn",
    "Career Transitions",
    "Salary Negotiation",
    "Job Search Strategy",
    "Networking",
  ],
  "Product Management": [
    "PM Interviews",
    "Product Strategy",
    "Roadmapping",
    "Stakeholder Management",
    "0-to-1 Products",
    "Growth PM",
  ],
  "Software Engineering": [
    "Technical Interviews",
    "System Design",
    "Behavioral Interviews",
    "Career Laddering",
    "Offer Negotiation",
  ],
  "MBA Admissions": [
    "Essay Editing",
    "School Selection",
    "Interview Prep",
    "Reapplicant Strategy",
    "Waitlist Strategy",
  ],
};

export const COACH_CLIENT_SPECIALIZATIONS = [
  "First generation",
  "International",
  "LGBTQ+",
  "Low income",
  "Veteran",
  "Career changers",
  "Returning to workforce",
] as const;

export function expertiseForCategory(category: string): string[] {
  if (COACH_EXPERTISE_BY_CATEGORY[category]) return COACH_EXPERTISE_BY_CATEGORY[category];
  return [
    "Interview Prep",
    "Resume & LinkedIn",
    "Career Strategy",
    "Offer Negotiation",
    "Networking",
    "Industry Insights",
  ];
}

export function categoriesForGoal(goal: CoachGoalId): CoachCategoryGroup[] {
  return COACH_CATEGORY_GROUPS.filter((g) => g.goal === goal);
}

export function allCategoriesForGoal(goal: CoachGoalId): string[] {
  return categoriesForGoal(goal).flatMap((g) => g.categories);
}
