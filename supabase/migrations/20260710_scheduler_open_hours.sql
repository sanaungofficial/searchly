ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerTimezone" TEXT DEFAULT 'America/New_York';
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerOpenHourStart" TEXT DEFAULT '09:00';
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerOpenHourEnd" TEXT DEFAULT '17:00';
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "schedulerOpenDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5];
