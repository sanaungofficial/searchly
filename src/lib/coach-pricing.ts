import type { CoachBulkDiscount, CoachIntroOfferType, CoachPricingPackage } from "@prisma/client";

export type PricingTierId = "new" | "experienced" | "seasoned";

export type RecommendedTier = {
  id: PricingTierId;
  label: string;
  minRate: number;
  maxRate: number | null;
  color: string;
  bg: string;
};

export const RECOMMENDED_TIERS: RecommendedTier[] = [
  { id: "new", label: "New", minRate: 25, maxRate: 100, color: "#7A6020", bg: "rgba(196,168,106,0.2)" },
  { id: "experienced", label: "Experienced", minRate: 100, maxRate: 250, color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  { id: "seasoned", label: "Seasoned", minRate: 250, maxRate: null, color: "#78350f", bg: "rgba(120,53,15,0.12)" },
];

/** Default bulk discounts (Leland defaults). */
export const DEFAULT_BULK_DISCOUNTS: Array<{ minHours: number; discountPercent: number; sortOrder: number }> = [
  { minHours: 3, discountPercent: 3, sortOrder: 0 },
  { minHours: 5, discountPercent: 5, sortOrder: 1 },
  { minHours: 10, discountPercent: 10, sortOrder: 2 },
];

/** Default hour packages synced to hourly rate. */
export const DEFAULT_PACKAGE_HOURS = [1, 3, 5, 10] as const;

/** Kimchi platform take rate by client lifetime spend (mirrors Leland sliding scale). */
export const PLATFORM_TAKE_TIERS = [
  { label: "First $500 spent", platformPercent: 20 },
  { label: "$500 – $2,000", platformPercent: 15 },
  { label: "$2,000 – $5,000", platformPercent: 10 },
  { label: "$5,000+", platformPercent: 5 },
] as const;

export const SALES_ASSISTED_FEE_PERCENT = 10;
export const SELF_REFERRAL_PLATFORM_PERCENT = 5;
export const STRIPE_FEE_PERCENT = 2.9;
export const STRIPE_FEE_FIXED_CENTS = 30;

export type BulkDiscountRow = Pick<
  CoachBulkDiscount,
  "id" | "minHours" | "discountPercent" | "enabled" | "sortOrder"
>;

export type PricingPackageRow = Pick<
  CoachPricingPackage,
  "id" | "hours" | "label" | "priceCents" | "syncedToHourly" | "enabled" | "sortOrder"
> & {
  displayPriceCents: number | null;
  displayPriceLabel: string | null;
};

export type CoachPricingPayload = {
  coachProfileId: string;
  slug: string | null;
  hourlyRate: number | null;
  introOfferType: CoachIntroOfferType;
  introDurationMinutes: number;
  trialSessionDurationMinutes: number | null;
  salesAssistedLeadsEnabled: boolean;
  partnerProgramEnabled: boolean;
  packagesSyncToHourly: boolean;
  experienceLevel: string | null;
  industryYears: number | null;
  packages: PricingPackageRow[];
  bulkDiscounts: BulkDiscountRow[];
  syncedPackageCount: number;
  unsyncedPackageCount: number;
  recommendedTier: RecommendedTier;
  takeHomeExamples: Array<{
    scenario: string;
    clientPays: number;
    platformFee: number;
    stripeFee: number;
    takeHome: number;
  }>;
};

export function inferRecommendedTier(experienceLevel: string | null, industryYears: number | null): RecommendedTier {
  const level = (experienceLevel ?? "").toLowerCase();
  if (level.includes("seasoned") || level.includes("senior") || level.includes("executive")) {
    return RECOMMENDED_TIERS[2];
  }
  if (level.includes("experienced") || level.includes("mid")) {
    return RECOMMENDED_TIERS[1];
  }
  if (industryYears != null) {
    if (industryYears >= 12) return RECOMMENDED_TIERS[2];
    if (industryYears >= 5) return RECOMMENDED_TIERS[1];
  }
  return RECOMMENDED_TIERS[0];
}

export function bulkDiscountForHours(
  hours: number,
  discounts: Array<{ minHours: number; discountPercent: number; enabled: boolean }>,
): number {
  const applicable = discounts
    .filter((d) => d.enabled && hours >= d.minHours)
    .sort((a, b) => b.minHours - a.minHours);
  return applicable[0]?.discountPercent ?? 0;
}

export function computePackagePriceCents(
  hourlyRate: number | null,
  hours: number,
  discounts: Array<{ minHours: number; discountPercent: number; enabled: boolean }>,
  packageRow: { priceCents: number | null; syncedToHourly: boolean },
  packagesSyncToHourly: boolean,
): number | null {
  if (!packageRow.syncedToHourly && packageRow.priceCents != null) {
    return packageRow.priceCents;
  }
  if (!packagesSyncToHourly && packageRow.priceCents != null) {
    return packageRow.priceCents;
  }
  if (hourlyRate == null || hourlyRate < 1) return null;
  const subtotalCents = hourlyRate * 100 * hours;
  const discount = bulkDiscountForHours(hours, discounts);
  return Math.round(subtotalCents * (1 - discount / 100));
}

export function formatUsdFromCents(cents: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function platformTakePercentForSpend(lifetimeSpendCents: number): number {
  const dollars = lifetimeSpendCents / 100;
  if (dollars >= 5000) return 5;
  if (dollars >= 2000) return 10;
  if (dollars >= 500) return 15;
  return 20;
}

export function computeTakeHome(
  clientPaysCents: number,
  options: { lifetimeSpendCents?: number; salesAssisted?: boolean; selfReferral?: boolean },
): { platformFeeCents: number; stripeFeeCents: number; takeHomeCents: number } {
  const platformPercent = options.selfReferral
    ? SELF_REFERRAL_PLATFORM_PERCENT
    : platformTakePercentForSpend(options.lifetimeSpendCents ?? 0) + (options.salesAssisted ? SALES_ASSISTED_FEE_PERCENT : 0);
  const platformFeeCents = Math.round(clientPaysCents * (platformPercent / 100));
  const stripeFeeCents = Math.round(clientPaysCents * (STRIPE_FEE_PERCENT / 100)) + STRIPE_FEE_FIXED_CENTS;
  const takeHomeCents = Math.max(0, clientPaysCents - platformFeeCents - stripeFeeCents);
  return { platformFeeCents, stripeFeeCents, takeHomeCents };
}

export function buildTakeHomeExamples(hourlyRate: number | null) {
  if (hourlyRate == null || hourlyRate < 1) return [];
  const oneHourCents = hourlyRate * 100;
  return [
    {
      scenario: "Marketplace lead — first session",
      ...(() => {
        const r = computeTakeHome(oneHourCents, { lifetimeSpendCents: 0 });
        return {
          clientPays: oneHourCents,
          platformFee: r.platformFeeCents,
          stripeFee: r.stripeFeeCents,
          takeHome: r.takeHomeCents,
        };
      })(),
    },
    {
      scenario: "Marketplace lead — after $5k spent",
      ...(() => {
        const r = computeTakeHome(oneHourCents, { lifetimeSpendCents: 500_000 });
        return {
          clientPays: oneHourCents,
          platformFee: r.platformFeeCents,
          stripeFee: r.stripeFeeCents,
          takeHome: r.takeHomeCents,
        };
      })(),
    },
    {
      scenario: "Sales-assisted lead",
      ...(() => {
        const r = computeTakeHome(oneHourCents, { lifetimeSpendCents: 0, salesAssisted: true });
        return {
          clientPays: oneHourCents,
          platformFee: r.platformFeeCents,
          stripeFee: r.stripeFeeCents,
          takeHome: r.takeHomeCents,
        };
      })(),
    },
    {
      scenario: "Your own referral",
      ...(() => {
        const r = computeTakeHome(oneHourCents, { selfReferral: true });
        return {
          clientPays: oneHourCents,
          platformFee: r.platformFeeCents,
          stripeFee: r.stripeFeeCents,
          takeHome: r.takeHomeCents,
        };
      })(),
    },
  ];
}

export function enrichPackages(
  packages: CoachPricingPackage[],
  hourlyRate: number | null,
  bulkDiscounts: CoachBulkDiscount[],
  packagesSyncToHourly: boolean,
): PricingPackageRow[] {
  return packages
    .filter((p) => p.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.hours - b.hours)
    .map((p) => {
      const displayPriceCents = computePackagePriceCents(hourlyRate, p.hours, bulkDiscounts, p, packagesSyncToHourly);
      const label = p.label ?? `${p.hours} hour${p.hours === 1 ? "" : "s"}`;
      return {
        id: p.id,
        hours: p.hours,
        label: p.label,
        priceCents: p.priceCents,
        syncedToHourly: p.syncedToHourly,
        enabled: p.enabled,
        sortOrder: p.sortOrder,
        displayPriceCents,
        displayPriceLabel: displayPriceCents != null ? `${formatUsdFromCents(displayPriceCents)} · ${label}` : label,
      };
    });
}
