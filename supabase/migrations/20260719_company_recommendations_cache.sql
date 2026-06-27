ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "companyRecommendationsCache" JSONB;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "companyRecommendationsUpdatedAt" TIMESTAMP(3);
