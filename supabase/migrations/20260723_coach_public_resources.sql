-- Public coach resources + client wins on profile

ALTER TABLE "CoachProfile"
  ADD COLUMN IF NOT EXISTS "clientWins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "CoachSharedDocument"
  ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CoachSharedDocument"
  ALTER COLUMN "clientUserId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "CoachSharedDocument_coachProfileId_isPublic_idx"
  ON "CoachSharedDocument"("coachProfileId", "isPublic");
