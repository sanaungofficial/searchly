CREATE TABLE IF NOT EXISTS "CoachClientSessionNote" (
  "id" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "clientUserId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "coachBookingId" TEXT,
  "sessionNotes" TEXT,
  "homework" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachClientSessionNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoachClientSessionNote_clientUserId_idx"
  ON "CoachClientSessionNote"("clientUserId");
CREATE INDEX IF NOT EXISTS "CoachClientSessionNote_coachProfileId_clientUserId_idx"
  ON "CoachClientSessionNote"("coachProfileId", "clientUserId");

DO $$ BEGIN
  ALTER TABLE "CoachClientSessionNote"
    ADD CONSTRAINT "CoachClientSessionNote_coachProfileId_fkey"
    FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CoachClientSessionNote"
    ADD CONSTRAINT "CoachClientSessionNote_clientUserId_fkey"
    FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CoachClientSessionNote"
    ADD CONSTRAINT "CoachClientSessionNote_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CoachClientSessionNote"
    ADD CONSTRAINT "CoachClientSessionNote_coachBookingId_fkey"
    FOREIGN KEY ("coachBookingId") REFERENCES "CoachBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
