-- Platform comms email fields (job search, coaching reminders, live reminders)

ALTER TABLE "UserDigestSettings"
  ADD COLUMN IF NOT EXISTS "watchlistEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "lastWatchlistSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastWatchlistJobIds" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "pipelineEmailEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "pipelineFollowUpSentAt" TIMESTAMP(3);

ALTER TABLE "LiveSessionRegistration"
  ADD COLUMN IF NOT EXISTS "reminder24hSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reminder1hSentAt" TIMESTAMP(3);

ALTER TABLE "CoachBooking"
  ADD COLUMN IF NOT EXISTS "reminder24hSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reminder1hSentAt" TIMESTAMP(3);

ALTER TABLE "LiveSession"
  ADD COLUMN IF NOT EXISTS "followerPostSessionSentAt" TIMESTAMP(3);

ALTER TYPE "CoachBookingCommType" ADD VALUE IF NOT EXISTS 'REMINDER_24H';
ALTER TYPE "CoachBookingCommType" ADD VALUE IF NOT EXISTS 'REMINDER_1H';
ALTER TYPE "CoachBookingCommType" ADD VALUE IF NOT EXISTS 'GUEST_RESCHEDULED';
