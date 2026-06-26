-- Coach pricing settings (Leland-style offerings/pricing page)

DO $$ BEGIN
  CREATE TYPE "CoachIntroOfferType" AS ENUM ('FREE_INTRO', 'TRIAL_SESSION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CoachProfile"
  ADD COLUMN IF NOT EXISTS "introOfferType" "CoachIntroOfferType" NOT NULL DEFAULT 'FREE_INTRO',
  ADD COLUMN IF NOT EXISTS "introDurationMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "trialSessionDurationMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "salesAssistedLeadsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "partnerProgramEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "packagesSyncToHourly" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "CoachPricingPackage" (
  "id" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "hours" INTEGER NOT NULL,
  "label" TEXT,
  "priceCents" INTEGER,
  "syncedToHourly" BOOLEAN NOT NULL DEFAULT true,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoachPricingPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CoachBulkDiscount" (
  "id" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "minHours" INTEGER NOT NULL,
  "discountPercent" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoachBulkDiscount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoachPricingPackage_coachProfileId_hours_key"
  ON "CoachPricingPackage"("coachProfileId", "hours");
CREATE INDEX IF NOT EXISTS "CoachPricingPackage_coachProfileId_idx"
  ON "CoachPricingPackage"("coachProfileId");

CREATE UNIQUE INDEX IF NOT EXISTS "CoachBulkDiscount_coachProfileId_minHours_key"
  ON "CoachBulkDiscount"("coachProfileId", "minHours");
CREATE INDEX IF NOT EXISTS "CoachBulkDiscount_coachProfileId_idx"
  ON "CoachBulkDiscount"("coachProfileId");

DO $$ BEGIN
  ALTER TABLE "CoachPricingPackage"
    ADD CONSTRAINT "CoachPricingPackage_coachProfileId_fkey"
    FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoachBulkDiscount"
    ADD CONSTRAINT "CoachBulkDiscount_coachProfileId_fkey"
    FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
