-- Extend coach packages for Leland-style package management

ALTER TABLE "CoachPricingPackage"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "hoursMax" INTEGER,
  ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "CoachPricingPackage_coachProfileId_hours_key";
