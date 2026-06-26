import { CoachIntroOfferType } from "@prisma/client";
import {
  buildTakeHomeExamples,
  DEFAULT_BULK_DISCOUNTS,
  DEFAULT_PACKAGE_HOURS,
  DEFAULT_PACKAGE_TITLES,
  enrichPackages,
  inferRecommendedTier,
  type CoachPricingPayload,
} from "@/lib/coach-pricing";
import { prisma } from "@/lib/prisma";

export const pricingInclude = {
  pricingPackages: { orderBy: { sortOrder: "asc" as const } },
  bulkDiscounts: { orderBy: { sortOrder: "asc" as const } },
};

export async function ensurePricingDefaults(coachProfileId: string) {
  const [packageCount, discountCount] = await Promise.all([
    prisma.coachPricingPackage.count({ where: { coachProfileId } }),
    prisma.coachBulkDiscount.count({ where: { coachProfileId } }),
  ]);

  if (packageCount === 0) {
    await prisma.coachPricingPackage.createMany({
      data: DEFAULT_PACKAGE_HOURS.map((hours, i) => ({
        coachProfileId,
        hours,
        title: DEFAULT_PACKAGE_TITLES[hours],
        syncedToHourly: true,
        isPublic: true,
        enabled: false,
        sortOrder: i,
      })),
    });
  }

  if (discountCount === 0) {
    await prisma.coachBulkDiscount.createMany({
      data: DEFAULT_BULK_DISCOUNTS.map((d) => ({
        coachProfileId,
        minHours: d.minHours,
        discountPercent: d.discountPercent,
        enabled: true,
        sortOrder: d.sortOrder,
      })),
    });
  }
}

export function serializePricing(profile: {
  id: string;
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
  category: string | null;
  pricingPackages: Array<{
    id: string;
    hours: number;
    hoursMax: number | null;
    title: string | null;
    description: string | null;
    label: string | null;
    priceCents: number | null;
    syncedToHourly: boolean;
    isPublic: boolean;
    enabled: boolean;
    sortOrder: number;
  }>;
  bulkDiscounts: Array<{
    id: string;
    minHours: number;
    discountPercent: number;
    enabled: boolean;
    sortOrder: number;
  }>;
}): CoachPricingPayload {
  const packages = enrichPackages(
    profile.pricingPackages,
    profile.hourlyRate,
    profile.bulkDiscounts,
    profile.packagesSyncToHourly,
    { includeDisabled: true },
  );
  const syncedPackageCount = profile.pricingPackages.filter((p) => p.enabled && p.syncedToHourly).length;
  const unsyncedPackageCount = profile.pricingPackages.filter((p) => p.enabled && !p.syncedToHourly).length;

  return {
    coachProfileId: profile.id,
    slug: profile.slug,
    hourlyRate: profile.hourlyRate,
    introOfferType: profile.introOfferType,
    introDurationMinutes: profile.introDurationMinutes,
    trialSessionDurationMinutes: profile.trialSessionDurationMinutes,
    salesAssistedLeadsEnabled: profile.salesAssistedLeadsEnabled,
    partnerProgramEnabled: profile.partnerProgramEnabled,
    packagesSyncToHourly: profile.packagesSyncToHourly,
    experienceLevel: profile.experienceLevel,
    industryYears: profile.industryYears,
    category: profile.category,
    packages,
    bulkDiscounts: profile.bulkDiscounts
      .filter((d) => d.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.minHours - b.minHours),
    syncedPackageCount,
    unsyncedPackageCount,
    recommendedTier: inferRecommendedTier(profile.experienceLevel, profile.industryYears),
    takeHomeExamples: buildTakeHomeExamples(profile.hourlyRate),
  };
}

type PackageInput = {
  id?: string;
  title?: string | null;
  description?: string | null;
  hours: number;
  hoursMax?: number | null;
  label?: string | null;
  priceCents?: number | null;
  syncedToHourly?: boolean;
  isPublic?: boolean;
  enabled?: boolean;
  sortOrder?: number;
};

type BulkDiscountInput = {
  id?: string;
  minHours: number;
  discountPercent: number;
  enabled?: boolean;
  sortOrder?: number;
};

export async function applyCoachPricingPatch(coachProfileId: string, body: Record<string, unknown>) {
  await ensurePricingDefaults(coachProfileId);

  const profileData: Record<string, unknown> = {};

  if (body.hourlyRate !== undefined) {
    profileData.hourlyRate = body.hourlyRate ? Math.max(1, Math.round(Number(body.hourlyRate))) : null;
  }
  if (body.introOfferType !== undefined) {
    const t = body.introOfferType as string;
    if (t === "TRIAL_SESSION" || t === "FREE_INTRO") {
      profileData.introOfferType = t as CoachIntroOfferType;
    }
  }
  if (body.introDurationMinutes !== undefined) {
    const mins = Math.round(Number(body.introDurationMinutes));
    profileData.introDurationMinutes = Number.isFinite(mins) ? Math.min(60, Math.max(15, mins)) : 15;
  }
  if (body.trialSessionDurationMinutes !== undefined) {
    const raw = body.trialSessionDurationMinutes;
    if (raw == null || raw === "") {
      profileData.trialSessionDurationMinutes = null;
    } else {
      const mins = Math.round(Number(raw));
      profileData.trialSessionDurationMinutes = Number.isFinite(mins)
        ? Math.min(120, Math.max(15, mins))
        : null;
    }
  }
  if (body.salesAssistedLeadsEnabled !== undefined) {
    profileData.salesAssistedLeadsEnabled = Boolean(body.salesAssistedLeadsEnabled);
  }
  if (body.partnerProgramEnabled !== undefined) {
    profileData.partnerProgramEnabled = Boolean(body.partnerProgramEnabled);
  }
  if (body.packagesSyncToHourly !== undefined) {
    profileData.packagesSyncToHourly = Boolean(body.packagesSyncToHourly);
  }

  if (Object.keys(profileData).length > 0) {
    await prisma.coachProfile.update({
      where: { id: coachProfileId },
      data: profileData,
    });
  }

  if (Array.isArray(body.packages)) {
    for (const pkg of body.packages as PackageInput[]) {
      const hours = Math.round(Number(pkg.hours));
      if (!Number.isFinite(hours) || hours < 1) continue;
      const hoursMaxRaw = pkg.hoursMax;
      const hoursMax =
        hoursMaxRaw != null && hoursMaxRaw !== ""
          ? Math.round(Number(hoursMaxRaw))
          : null;
      const data = {
        hours,
        hoursMax: hoursMax != null && Number.isFinite(hoursMax) && hoursMax > hours ? hoursMax : null,
        title: pkg.title?.trim() || null,
        description: pkg.description?.trim() || null,
        label: pkg.label?.trim() || null,
        priceCents: pkg.priceCents != null ? Math.round(Number(pkg.priceCents)) : null,
        syncedToHourly: pkg.syncedToHourly ?? true,
        isPublic: pkg.isPublic ?? true,
        enabled: pkg.enabled ?? true,
        sortOrder: pkg.sortOrder ?? 0,
      };
      if (pkg.id) {
        await prisma.coachPricingPackage.updateMany({
          where: { id: pkg.id, coachProfileId },
          data,
        });
      } else {
        await prisma.coachPricingPackage.create({
          data: { coachProfileId, ...data },
        });
      }
    }
  }

  if (Array.isArray(body.bulkDiscounts)) {
    for (const row of body.bulkDiscounts as BulkDiscountInput[]) {
      const minHours = Math.round(Number(row.minHours));
      const discountPercent = Math.round(Number(row.discountPercent));
      if (!Number.isFinite(minHours) || minHours < 1) continue;
      if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 50) continue;
      const data = {
        minHours,
        discountPercent,
        enabled: row.enabled ?? true,
        sortOrder: row.sortOrder ?? 0,
      };
      if (row.id) {
        await prisma.coachBulkDiscount.updateMany({
          where: { id: row.id, coachProfileId },
          data,
        });
      } else {
        await prisma.coachBulkDiscount.upsert({
          where: { coachProfileId_minHours: { coachProfileId, minHours } },
          create: { coachProfileId, ...data },
          update: data,
        });
      }
    }
  }

  if (body.deletePackageId && typeof body.deletePackageId === "string") {
    await prisma.coachPricingPackage.deleteMany({
      where: { id: body.deletePackageId, coachProfileId },
    });
  }

  if (body.deleteBulkDiscountId && typeof body.deleteBulkDiscountId === "string") {
    await prisma.coachBulkDiscount.deleteMany({
      where: { id: body.deleteBulkDiscountId, coachProfileId },
    });
  }

  const fresh = await prisma.coachProfile.findUnique({
    where: { id: coachProfileId },
    include: pricingInclude,
  });
  return fresh;
}
