-- LinkedIn profile preview draft (Profile → LinkedIn tab)
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "linkedInDraft" JSONB;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "linkedInDraftUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "linkedInDraftSourceAssetId" TEXT;
