ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "CoachClientAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "assignedByUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachClientAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoachClientAssignment_userId_coachProfileId_key"
  ON "CoachClientAssignment"("userId", "coachProfileId");
CREATE INDEX IF NOT EXISTS "CoachClientAssignment_userId_idx" ON "CoachClientAssignment"("userId");
CREATE INDEX IF NOT EXISTS "CoachClientAssignment_coachProfileId_idx" ON "CoachClientAssignment"("coachProfileId");

DO $$ BEGIN
  ALTER TABLE "CoachClientAssignment"
    ADD CONSTRAINT "CoachClientAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoachClientAssignment"
    ADD CONSTRAINT "CoachClientAssignment_coachProfileId_fkey"
    FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoachClientAssignment"
    ADD CONSTRAINT "CoachClientAssignment_assignedByUserId_fkey"
    FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
