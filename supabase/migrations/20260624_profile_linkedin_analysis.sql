ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "linkedInDraftAnalysis" JSONB;
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "linkedInDraftAnalysisUpdatedAt" TIMESTAMP(3);
