-- Coaching package purchases (Leland-style admin tracking + Stripe checkout)

DO $$ BEGIN
  CREATE TYPE "CoachPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CoachPurchaseLeadSource" AS ENUM ('MARKETPLACE', 'SALES_ASSISTED', 'COACH_REFERRAL', 'DIRECT_LINK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CoachPurchase" (
  "id" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "buyerUserId" TEXT,
  "packageId" TEXT,
  "packageTitle" TEXT NOT NULL,
  "packageHours" INTEGER NOT NULL,
  "packageHoursMax" INTEGER,
  "amountCents" INTEGER NOT NULL,
  "platformFeeCents" INTEGER NOT NULL,
  "stripeFeeCents" INTEGER NOT NULL DEFAULT 0,
  "coachPayoutCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "hoursGranted" INTEGER NOT NULL,
  "hoursRemaining" INTEGER NOT NULL,
  "status" "CoachPurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "leadSource" "CoachPurchaseLeadSource" NOT NULL DEFAULT 'MARKETPLACE',
  "salesAssisted" BOOLEAN NOT NULL DEFAULT false,
  "buyerEmail" TEXT,
  "buyerName" TEXT,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "paidAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoachPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoachPurchase_stripeCheckoutSessionId_key"
  ON "CoachPurchase"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "CoachPurchase_stripePaymentIntentId_key"
  ON "CoachPurchase"("stripePaymentIntentId");
CREATE INDEX IF NOT EXISTS "CoachPurchase_coachProfileId_idx" ON "CoachPurchase"("coachProfileId");
CREATE INDEX IF NOT EXISTS "CoachPurchase_buyerUserId_idx" ON "CoachPurchase"("buyerUserId");
CREATE INDEX IF NOT EXISTS "CoachPurchase_status_idx" ON "CoachPurchase"("status");
CREATE INDEX IF NOT EXISTS "CoachPurchase_createdAt_idx" ON "CoachPurchase"("createdAt");

DO $$ BEGIN
  ALTER TABLE "CoachPurchase"
    ADD CONSTRAINT "CoachPurchase_coachProfileId_fkey"
    FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoachPurchase"
    ADD CONSTRAINT "CoachPurchase_buyerUserId_fkey"
    FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoachPurchase"
    ADD CONSTRAINT "CoachPurchase_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "CoachPricingPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
