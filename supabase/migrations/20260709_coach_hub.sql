-- Coach hub: link bookings to Kimchi users + communication log
ALTER TABLE "CoachBooking"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "CoachBooking_userId_idx"
  ON "CoachBooking" ("userId");

CREATE INDEX IF NOT EXISTS "CoachBooking_guestEmail_idx"
  ON "CoachBooking" ("guestEmail");

ALTER TABLE "CoachBooking"
  ADD CONSTRAINT "CoachBooking_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill userId from guest email
UPDATE "CoachBooking" b
SET "userId" = u.id
FROM "User" u
WHERE b."userId" IS NULL
  AND b."guestEmail" IS NOT NULL
  AND lower(b."guestEmail") = lower(u.email);

CREATE TYPE "CoachBookingCommType" AS ENUM (
  'GUEST_CONFIRMATION',
  'COACH_NOTIFICATION',
  'CANCELLATION',
  'SESSION_BOOKED',
  'SESSION_RESCHEDULED'
);

CREATE TYPE "CoachBookingCommAudience" AS ENUM (
  'GUEST',
  'COACH'
);

CREATE TABLE IF NOT EXISTS "CoachBookingCommunication" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT,
  "coachProfileId" TEXT NOT NULL,
  "clientUserId" TEXT,
  "type" "CoachBookingCommType" NOT NULL,
  "audience" "CoachBookingCommAudience" NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyPreview" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachBookingCommunication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoachBookingCommunication_coachProfileId_createdAt_idx"
  ON "CoachBookingCommunication" ("coachProfileId", "createdAt");

CREATE INDEX IF NOT EXISTS "CoachBookingCommunication_clientUserId_createdAt_idx"
  ON "CoachBookingCommunication" ("clientUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "CoachBookingCommunication_bookingId_idx"
  ON "CoachBookingCommunication" ("bookingId");

ALTER TABLE "CoachBookingCommunication"
  ADD CONSTRAINT "CoachBookingCommunication_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "CoachBooking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CoachBookingCommunication"
  ADD CONSTRAINT "CoachBookingCommunication_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoachBookingCommunication"
  ADD CONSTRAINT "CoachBookingCommunication_clientUserId_fkey"
  FOREIGN KEY ("clientUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
