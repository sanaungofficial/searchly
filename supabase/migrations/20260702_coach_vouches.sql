CREATE TABLE IF NOT EXISTS "CoachVouch" (
  "id" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "authorEmail" TEXT,
  "relationship" TEXT,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachVouch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoachVouch_coachProfileId_idx" ON "CoachVouch"("coachProfileId");

ALTER TABLE "CoachVouch"
  ADD CONSTRAINT "CoachVouch_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
