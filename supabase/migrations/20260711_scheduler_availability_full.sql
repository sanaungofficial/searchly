ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerWeeklyHours" JSONB;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerBufferMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerMinBookingNoticeMinutes" INTEGER NOT NULL DEFAULT 1440;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerCapacityHoursPerWeek" INTEGER;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerAvailabilityNotes" TEXT;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerBlackoutDates" JSONB;
