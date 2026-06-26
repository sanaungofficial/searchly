-- Nylas coach enhancements: dual scheduler configs, grant status, email sync, calendars

ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "nylasGrantStatus" TEXT DEFAULT 'active';
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "nylasEmailSyncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "nylasIntroSchedulerConfigId" TEXT;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "nylasIntroSchedulerSlug" TEXT;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "nylasSchedulerCalendarIds" JSONB;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "nylasConferenceProvider" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CoachProfile_nylasIntroSchedulerConfigId_key"
  ON "CoachProfile"("nylasIntroSchedulerConfigId");
