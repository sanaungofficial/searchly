ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "profileSuggestionsData" JSONB;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "profileSuggestionsUpdatedAt" TIMESTAMP(3);
