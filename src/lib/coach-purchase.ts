import type { CoachBulkDiscount, CoachPricingPackage } from "@prisma/client";
import { CoachPurchaseLeadSource, CoachPurchaseStatus } from "@prisma/client";
import {
  bulkDiscountForHours,
  computePackagePriceCents,
  computeTakeHome,
  packageDisplayTitle,
  platformTakePercentForSpend,
  SALES_ASSISTED_FEE_PERCENT,
} from "@/lib/coach-pricing";
import { prisma } from "@/lib/prisma";

export type PackageQuote = {
  packageId: string;
  title: string;
  hours: number;
  hoursMax: number | null;
  amountCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  coachPayoutCents: number;
  hoursGranted: number;
};

export function resolvePackageQuote(params: {
  pkg: CoachPricingPackage;
  hourlyRate: number | null;
  bulkDiscounts: CoachBulkDiscount[];
  packagesSyncToHourly: boolean;
  buyerLifetimeSpendCents?: number;
  leadSource?: CoachPurchaseLeadSource;
  salesAssisted?: boolean;
}): PackageQuote | null {
  const { pkg, hourlyRate, bulkDiscounts, packagesSyncToHourly } = params;
  const hoursGranted = pkg.hoursMax != null && pkg.hoursMax > pkg.hours ? pkg.hoursMax : pkg.hours;
  const amountCents = computePackagePriceCents(hourlyRate, hoursGranted, bulkDiscounts, pkg, packagesSyncToHourly);
  if (amountCents == null || amountCents < 100) return null;

  const leadSource = params.leadSource ?? CoachPurchaseLeadSource.MARKETPLACE;
  const salesAssisted =
    params.salesAssisted ??
    (leadSource === CoachPurchaseLeadSource.SALES_ASSISTED);

  const takeHome = computeTakeHome(amountCents, {
    lifetimeSpendCents: params.buyerLifetimeSpendCents ?? 0,
    salesAssisted,
    selfReferral: leadSource === CoachPurchaseLeadSource.COACH_REFERRAL,
  });

  const platformFeeCents = amountCents - takeHome.takeHomeCents - takeHome.stripeFeeCents;

  return {
    packageId: pkg.id,
    title: packageDisplayTitle(pkg),
    hours: pkg.hours,
    hoursMax: pkg.hoursMax,
    amountCents,
    platformFeeCents,
    stripeFeeCents: takeHome.stripeFeeCents,
    coachPayoutCents: takeHome.takeHomeCents,
    hoursGranted,
  };
}

export async function buyerLifetimeCoachSpendCents(userId: string): Promise<number> {
  const agg = await prisma.coachPurchase.aggregate({
    where: { buyerUserId: userId, status: CoachPurchaseStatus.PAID },
    _sum: { amountCents: true },
  });
  return agg._sum.amountCents ?? 0;
}

export async function loadPackageForCheckout(packageId: string, coachProfileId: string) {
  return prisma.coachPricingPackage.findFirst({
    where: { id: packageId, coachProfileId, enabled: true },
    include: {
      coachProfile: {
        include: { bulkDiscounts: { where: { enabled: true } } },
      },
    },
  });
}

export function formatPurchaseLeadSource(source: CoachPurchaseLeadSource): string {
  switch (source) {
    case CoachPurchaseLeadSource.SALES_ASSISTED:
      return "Sales assisted";
    case CoachPurchaseLeadSource.COACH_REFERRAL:
      return "Coach referral";
    case CoachPurchaseLeadSource.DIRECT_LINK:
      return "Direct link";
    default:
      return "Marketplace";
  }
}

export function formatPurchaseStatus(status: CoachPurchaseStatus): string {
  return status.toLowerCase().replace(/_/g, " ");
}

export function platformPercentLabel(lifetimeSpendCents: number, salesAssisted: boolean): string {
  const base = platformTakePercentForSpend(lifetimeSpendCents);
  if (salesAssisted) return `${base}% + ${SALES_ASSISTED_FEE_PERCENT}% sales`;
  return `${base}%`;
}

export type AdminPurchaseRow = {
  id: string;
  createdAt: string;
  paidAt: string | null;
  status: CoachPurchaseStatus;
  leadSource: CoachPurchaseLeadSource;
  salesAssisted: boolean;
  packageTitle: string;
  packageHours: number;
  packageHoursMax: number | null;
  hoursGranted: number;
  hoursRemaining: number;
  amountCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  coachPayoutCents: number;
  buyerEmail: string | null;
  buyerName: string | null;
  coachName: string;
  coachSlug: string | null;
  coachProfileId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
};

export function serializeAdminPurchase(
  p: {
    id: string;
    createdAt: Date;
    paidAt: Date | null;
    status: CoachPurchaseStatus;
    leadSource: CoachPurchaseLeadSource;
    salesAssisted: boolean;
    packageTitle: string;
    packageHours: number;
    packageHoursMax: number | null;
    hoursGranted: number;
    hoursRemaining: number;
    amountCents: number;
    platformFeeCents: number;
    stripeFeeCents: number;
    coachPayoutCents: number;
    buyerEmail: string | null;
    buyerName: string | null;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntentId: string | null;
    coachProfile: { id: string; displayName: string; slug: string | null };
    buyer: { email: string; name: string | null } | null;
  },
): AdminPurchaseRow {
  return {
    id: p.id,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
    status: p.status,
    leadSource: p.leadSource,
    salesAssisted: p.salesAssisted,
    packageTitle: p.packageTitle,
    packageHours: p.packageHours,
    packageHoursMax: p.packageHoursMax,
    hoursGranted: p.hoursGranted,
    hoursRemaining: p.hoursRemaining,
    amountCents: p.amountCents,
    platformFeeCents: p.platformFeeCents,
    stripeFeeCents: p.stripeFeeCents,
    coachPayoutCents: p.coachPayoutCents,
    buyerEmail: p.buyerEmail ?? p.buyer?.email ?? null,
    buyerName: p.buyerName ?? p.buyer?.name ?? null,
    coachName: p.coachProfile.displayName,
    coachSlug: p.coachProfile.slug,
    coachProfileId: p.coachProfile.id,
    stripeCheckoutSessionId: p.stripeCheckoutSessionId,
    stripePaymentIntentId: p.stripePaymentIntentId,
  };
}

export async function markPurchasePaid(params: {
  purchaseId: string;
  stripePaymentIntentId?: string | null;
  stripeFeeCents?: number;
}) {
  const purchase = await prisma.coachPurchase.findUnique({ where: { id: params.purchaseId } });
  if (!purchase) return null;
  if (purchase.status === CoachPurchaseStatus.PAID) return purchase;

  return prisma.coachPurchase.update({
    where: { id: params.purchaseId },
    data: {
      status: CoachPurchaseStatus.PAID,
      paidAt: new Date(),
      ...(params.stripePaymentIntentId ? { stripePaymentIntentId: params.stripePaymentIntentId } : {}),
      ...(params.stripeFeeCents != null ? { stripeFeeCents: params.stripeFeeCents } : {}),
    },
  });
}

export async function markPurchaseRefunded(purchaseId: string, partial = false) {
  return prisma.coachPurchase.update({
    where: { id: purchaseId },
    data: {
      status: partial ? CoachPurchaseStatus.PARTIALLY_REFUNDED : CoachPurchaseStatus.REFUNDED,
      refundedAt: new Date(),
      hoursRemaining: 0,
    },
  });
}
