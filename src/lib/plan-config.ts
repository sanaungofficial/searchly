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
    description: "Stand out to recruiters in 6 secs",
    pro: "Unlimited",
    free: "2 credits/day",
  },
  {
    name: "Resume Tailoring",
    description: "Tailor your resume for every role",
    pro: "Unlimited",
    free: "2 credits/day",
  },
  {
    name: "Scout AI Agent",
    description: "Automate your job search",
    pro: "Unlimited",
    free: "Limited access",
  },
  {
    name: "AI Cover Letter",
    description: "Personalized pitch for every role",
    pro: "Unlimited",
    free: "2 credits/day",
  },
  {
    name: "Live Career Coaching",
    description: "Weekly personalized sessions",
    pro: "check",
    free: "x",
  },
  {
    name: "Insider Connection Email",
    description: "Perfect for cold outreach & referral",
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
    description: "Monitor target companies",
    pro: "Unlimited",
    free: "1 saved company",
  },
  {
    name: "Instant Job Alerts",
    description: "Always be the first to apply",
    pro: "Unlimited",
    free: "1 alert/day",
  },
];

export const FREE_FOR_ALL_FEATURES = [
  "Job pipeline tracking",
  "AI job matching",
  "Company insights",
  "Advanced job filtering",
  "24/7 chat with Scout",
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
