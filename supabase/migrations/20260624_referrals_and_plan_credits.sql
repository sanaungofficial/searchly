-- Referrals, daily feature credits, LinkedIn share trials

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_referredByUserId_idx" ON "User"("referredByUserId");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_fkey"
    FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TYPE "PlanCreditFeature" AS ENUM ('MATCH', 'TAILOR', 'COVER_LETTER', 'SCOUT', 'INSIDER', 'READBACK');

CREATE TABLE IF NOT EXISTS "DailyFeatureUsage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "feature" "PlanCreditFeature" NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyFeatureUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DailyFeatureUsage_userId_day_feature_key" ON "DailyFeatureUsage"("userId", "day", "feature");
CREATE INDEX IF NOT EXISTS "DailyFeatureUsage_userId_idx" ON "DailyFeatureUsage"("userId");

CREATE TABLE IF NOT EXISTS "FeatureCreditBonus" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "feature" "PlanCreditFeature" NOT NULL,
  "remaining" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureCreditBonus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FeatureCreditBonus_userId_feature_key" ON "FeatureCreditBonus"("userId", "feature");
CREATE INDEX IF NOT EXISTS "FeatureCreditBonus_userId_idx" ON "FeatureCreditBonus"("userId");

CREATE TABLE IF NOT EXISTS "ReferralEvent" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "refereeId" TEXT NOT NULL,
  "matchBonus" INTEGER NOT NULL DEFAULT 5,
  "tailorBonus" INTEGER NOT NULL DEFAULT 5,
  "insiderBonus" INTEGER NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralEvent_refereeId_key" ON "ReferralEvent"("refereeId");
CREATE INDEX IF NOT EXISTS "ReferralEvent_referrerId_idx" ON "ReferralEvent"("referrerId");

CREATE TYPE "LinkedInShareStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "LinkedInShareSubmission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "postUrl" TEXT NOT NULL,
  "status" "LinkedInShareStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LinkedInShareSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LinkedInShareSubmission_userId_idx" ON "LinkedInShareSubmission"("userId");

CREATE TABLE IF NOT EXISTS "ProTrialGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProTrialGrant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProTrialGrant_userId_idx" ON "ProTrialGrant"("userId");
CREATE INDEX IF NOT EXISTS "ProTrialGrant_expiresAt_idx" ON "ProTrialGrant"("expiresAt");
