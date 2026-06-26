/** JobRight-style plan + feature matrix for Kimchi Pro. */

export type BillingInterval = "weekly" | "monthly" | "quarterly";

export const PRO_PLANS: Record<
  BillingInterval,
  { label: string; price: number; compareAt?: number; savePct?: number; perMonthNote?: string; popular?: boolean }
> = {
  weekly: {
    label: "Weekly",
    price: 17.99,
    perMonthNote: "$71.96/month",
  },
  monthly: {
    label: "Monthly",
    price: 39.99,
    compareAt: 49.99,
    savePct: 20,
  },
  quarterly: {
    label: "Quarterly",
    price: 89.99,
    compareAt: 149.97,
    savePct: 40,
    popular: true,
  },
};

export type PlanFeatureRow = {
  name: string;
  description: string;
  pro: string | "check";
  free: string | "check" | "x";
};

export const PRO_FEATURE_ROWS: PlanFeatureRow[] = [
  {
    name: "AI Resume Match",
    description: "Score your fit against the job description",
    pro: "Unlimited",
    free: "2 credits/day",
  },
  {
    name: "Resume Tailoring",
    description: "Rewrite bullets to match each role",
    pro: "Unlimited",
    free: "2 credits/day",
  },
  {
    name: "Scout AI Agent",
    description: "Ask about roles, companies, and your pipeline",
    pro: "Unlimited",
    free: "Limited access",
  },
  {
    name: "AI Cover Letter",
    description: "Draft a letter from your resume and the listing",
    pro: "Unlimited",
    free: "2 credits/day",
  },
  {
    name: "Live Career Coaching",
    description: "Book 1:1 sessions with career coaches",
    pro: "check",
    free: "x",
  },
  {
    name: "Insider Connection Email",
    description: "Draft cold outreach and referral ask emails",
    pro: "Unlimited",
    free: "2 credits/day",
  },
  {
    name: "Job Pipeline Tracking",
    description: "Track every application in one place",
    pro: "Unlimited",
    free: "Unlimited",
  },
  {
    name: "Company Watchlist",
    description: "Save companies and scan for open roles",
    pro: "Unlimited",
    free: "1 saved company",
  },
  {
    name: "Instant Job Alerts",
    description: "Get notified when watched companies post",
    pro: "Unlimited",
    free: "1 alert/day",
  },
];

export const FREE_FOR_ALL_FEATURES = [
  "Track applications in your pipeline",
  "Paste a job URL for a match score",
  "Company profiles and job scans",
  "Filter and sort your opportunities",
  "Scout chat (uses credits on Free)",
] as const;

export const REFERRAL_BONUS_PER_FEATURE = 5;
export const LINKEDIN_SHARE_PRO_DAYS = 5;
export const REFERRAL_SUPPORT_EMAIL = "support@kimchi.so";

export function stripePriceEnvKey(interval: BillingInterval): string {
  const map: Record<BillingInterval, string> = {
    weekly: "STRIPE_PRICE_ID_WEEKLY",
    monthly: "STRIPE_PRICE_ID_MONTHLY",
    quarterly: "STRIPE_PRICE_ID_QUARTERLY",
  };
  return map[interval];
}

export function resolveStripePriceId(interval: BillingInterval): string | null {
  const key = stripePriceEnvKey(interval);
  const specific = process.env[key];
  if (specific) return specific;
  if (interval === "monthly") return process.env.STRIPE_PRICE_ID ?? null;
  return null;
}
