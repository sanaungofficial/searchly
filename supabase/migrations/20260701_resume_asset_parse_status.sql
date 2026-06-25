-- Background resume parse job status + target job title on assets
ALTER TABLE "UserAsset"
  ADD COLUMN IF NOT EXISTS "targetJobTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "parseStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "parseStartedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "parseCompletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "parseError" TEXT;
