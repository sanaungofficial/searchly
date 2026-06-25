-- Background career strategy generation job status
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "strategyGenerationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "strategyGenerationStartedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "strategyGenerationCompletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "strategyGenerationError" TEXT;
