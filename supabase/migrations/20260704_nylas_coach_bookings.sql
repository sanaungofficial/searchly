-- Nylas calendar + scheduler fields on coach profiles
ALTER TABLE "CoachProfile"
  ADD COLUMN IF NOT EXISTS "nylasGrantId" TEXT,
  ADD COLUMN IF NOT EXISTS "nylasSchedulerConfigId" TEXT,
  ADD COLUMN IF NOT EXISTS "nylasSchedulerSlug" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CoachProfile_nylasGrantId_key"
  ON "CoachProfile" ("nylasGrantId")
  WHERE "nylasGrantId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CoachProfile_nylasSchedulerConfigId_key"
  ON "CoachProfile" ("nylasSchedulerConfigId")
  WHERE "nylasSchedulerConfigId" IS NOT NULL;

-- Bookings synced from Nylas webhooks
CREATE TYPE "CoachBookingStatus" AS ENUM (
  'CONFIRMED',
  'PENDING',
  'CANCELLED',
  'RESCHEDULED'
);

CREATE TABLE IF NOT EXISTS "CoachBooking" (
  "id" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "nylasBookingId" TEXT,
  "nylasBookingRef" TEXT,
  "nylasConfigId" TEXT,
  "nylasEventId" TEXT,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "title" TEXT,
  "location" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "status" "CoachBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoachBooking_nylasBookingId_key"
  ON "CoachBooking" ("nylasBookingId")
  WHERE "nylasBookingId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CoachBooking_nylasBookingRef_key"
  ON "CoachBooking" ("nylasBookingRef")
  WHERE "nylasBookingRef" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "CoachBooking_coachProfileId_idx"
  ON "CoachBooking" ("coachProfileId");

CREATE INDEX IF NOT EXISTS "CoachBooking_startAt_idx"
  ON "CoachBooking" ("startAt");

ALTER TABLE "CoachBooking"
  ADD CONSTRAINT "CoachBooking_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
