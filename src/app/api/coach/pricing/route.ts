import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { CoachIntroOfferType, CoachStatus, UserRole } from "@prisma/client";
import {
  buildTakeHomeExamples,
  DEFAULT_BULK_DISCOUNTS,
  DEFAULT_PACKAGE_HOURS,
  enrichPackages,
  inferRecommendedTier,
  type CoachPricingPayload,
} from "@/lib/coach-pricing";
import { coachProfileSlug } from "@/lib/coach-slug";
import { pushCoachProfileToAirtable } from "@/lib/airtable/push-coach";

async function getCoachUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, role: true, email: true, name: true },
  });
  if (!dbUser || (dbUser.role !== UserRole.COACH && dbUser.role !== UserRole.ADMIN)) return null;
  return dbUser;
}

async function findAndLinkProfile(dbUser: { id: string; email: string }) {
  let profile = await prisma.coachProfile.findUnique({ where: { userId: dbUser.id } });
  if (!profile) {
    profile = await prisma.coachProfile.findUnique({ where: { email: dbUser.email } });
    if (profile) {
      profile = await prisma.coachProfile.update({
        where: { id: profile.id },
        data: { userId: dbUser.id },
      });
    }
  }
  return profile;
}

async function ensureCoachProfile(dbUser: { id: string; email: string; name: string | null }) {
  const existing = await findAndLinkProfile(dbUser);
  if (existing) return existing;

  const created = await prisma.coachProfile.create({
    data: {
      userId: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.name?.trim() || dbUser.email.split("@")[0],
      status: CoachStatus.PENDING,
    },
  });
  return prisma.coachProfile.update({
    where: { id: created.id },
    data: { slug: coachProfileSlug(created.displayName, created.id) },
  });
}

async function ensurePricingDefaults(coachProfileId: string) {
  const [packageCount, discountCount] = await Promise.all([
    prisma.coachPricingPackage.count({ where: { coachProfileId } }),
    prisma.coachBulkDiscount.count({ where: { coachProfileId } }),
  ]);

  if (packageCount === 0) {
    await prisma.coachPricingPackage.createMany({
      data: DEFAULT_PACKAGE_HOURS.map((hours, i) => ({
        coachProfileId,
        hours,
        syncedToHourly: true,
        enabled: true,
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

function serializePricing(profile: {
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
  pricingPackages: Array<{
    id: string;
    hours: number;
    label: string | null;
    priceCents: number | null;
    syncedToHourly: boolean;
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

const pricingInclude = {
  pricingPackages: { orderBy: { sortOrder: "asc" as const } },
  bulkDiscounts: { orderBy: { sortOrder: "asc" as const } },
};

export async function GET() {
  const me = await getCoachUser();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await findAndLinkProfile(me);
  if (!profile) return NextResponse.json({ error: "No coach profile" }, { status: 404 });

  await ensurePricingDefaults(profile.id);

  const fresh = await prisma.coachProfile.findUnique({
    where: { id: profile.id },
    include: pricingInclude,
  });
  if (!fresh) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json(serializePricing(fresh));
}

type PackageInput = {
  id?: string;
  hours: number;
  label?: string | null;
  priceCents?: number | null;
  syncedToHourly?: boolean;
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

export async function PATCH(req: NextRequest) {
  const me = await getCoachUser();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Record<string, unknown>;
  const profile = await ensureCoachProfile(me);
  await ensurePricingDefaults(profile.id);

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
      where: { id: profile.id },
      data: profileData,
    });
  }

  if (Array.isArray(body.packages)) {
    for (const pkg of body.packages as PackageInput[]) {
      const hours = Math.round(Number(pkg.hours));
      if (!Number.isFinite(hours) || hours < 1) continue;
      const data = {
        hours,
        label: pkg.label?.trim() || null,
        priceCents: pkg.priceCents != null ? Math.round(Number(pkg.priceCents)) : null,
        syncedToHourly: pkg.syncedToHourly ?? true,
        enabled: pkg.enabled ?? true,
        sortOrder: pkg.sortOrder ?? 0,
      };
      if (pkg.id) {
        await prisma.coachPricingPackage.updateMany({
          where: { id: pkg.id, coachProfileId: profile.id },
          data,
        });
      } else {
        await prisma.coachPricingPackage.upsert({
          where: { coachProfileId_hours: { coachProfileId: profile.id, hours } },
          create: { coachProfileId: profile.id, ...data },
          update: data,
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
          where: { id: row.id, coachProfileId: profile.id },
          data,
        });
      } else {
        await prisma.coachBulkDiscount.upsert({
          where: { coachProfileId_minHours: { coachProfileId: profile.id, minHours } },
          create: { coachProfileId: profile.id, ...data },
          update: data,
        });
      }
    }
  }

  if (body.deletePackageId && typeof body.deletePackageId === "string") {
    await prisma.coachPricingPackage.deleteMany({
      where: { id: body.deletePackageId, coachProfileId: profile.id },
    });
  }

  if (body.deleteBulkDiscountId && typeof body.deleteBulkDiscountId === "string") {
    await prisma.coachBulkDiscount.deleteMany({
      where: { id: body.deleteBulkDiscountId, coachProfileId: profile.id },
    });
  }

  const fresh = await prisma.coachProfile.findUnique({
    where: { id: profile.id },
    include: pricingInclude,
  });
  if (!fresh) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (fresh.airtableId) {
    try {
      await pushCoachProfileToAirtable(fresh.id);
    } catch (err) {
      console.error("[coach/pricing] airtable push", err);
    }
  }

  return NextResponse.json(serializePricing(fresh));
}
