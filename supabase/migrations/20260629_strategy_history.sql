-- Store previous career strategy document versions (current stays in strategyData)
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "strategyHistory" JSONB DEFAULT '[]'::jsonb;
