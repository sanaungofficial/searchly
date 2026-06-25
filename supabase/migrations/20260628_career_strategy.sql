-- Career Strategy: profile fields + STRATEGY credit feature
ALTER TYPE "PlanCreditFeature" ADD VALUE IF NOT EXISTS 'STRATEGY';

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "targetMarket" TEXT,
  ADD COLUMN IF NOT EXISTS "relocationOpenness" TEXT,
  ADD COLUMN IF NOT EXISTS "workAuthorization" TEXT,
  ADD COLUMN IF NOT EXISTS "securityClearance" TEXT,
  ADD COLUMN IF NOT EXISTS "searchDuration" TEXT,
  ADD COLUMN IF NOT EXISTS "positioningStatement" TEXT,
  ADD COLUMN IF NOT EXISTS "strategyData" JSONB,
  ADD COLUMN IF NOT EXISTS "strategyUpdatedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "strategySourceSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "strategyIntakeNotes" TEXT;
