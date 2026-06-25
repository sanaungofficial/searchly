-- Coach profile fields for marketplace directory + profile pages
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "calLink" TEXT;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "clientSpecializations" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "experienceLevel" TEXT;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "clientTier" TEXT;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "industryYears" INTEGER;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "isProfessionalCoach" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "whyCoach" TEXT;
ALTER TABLE "CoachProfile" ADD COLUMN IF NOT EXISTS "aboutMe" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CoachProfile_slug_key" ON "CoachProfile"("slug");

-- Backfill slugs for existing coaches (lowercase name + last 6 chars of id)
UPDATE "CoachProfile"
SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(TRIM("displayName"), '[^a-zA-Z0-9]+', '-', 'g'),
    '(^-|-$)',
    '',
    'g'
  )
) || '-' || RIGHT("id", 6)
WHERE "slug" IS NULL;

CREATE TABLE IF NOT EXISTS "CoachReview" (
  "id" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "coachedFor" TEXT,
  "rating" DOUBLE PRECISION NOT NULL,
  "knowledge" INTEGER NOT NULL,
  "value" INTEGER NOT NULL,
  "responsiveness" INTEGER NOT NULL,
  "supportiveness" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoachReview_coachProfileId_userId_key"
  ON "CoachReview"("coachProfileId", "userId");
CREATE INDEX IF NOT EXISTS "CoachReview_coachProfileId_idx" ON "CoachReview"("coachProfileId");

ALTER TABLE "CoachReview"
  ADD CONSTRAINT "CoachReview_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoachReview"
  ADD CONSTRAINT "CoachReview_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CoachFollow" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoachFollow_userId_coachProfileId_key"
  ON "CoachFollow"("userId", "coachProfileId");
CREATE INDEX IF NOT EXISTS "CoachFollow_coachProfileId_idx" ON "CoachFollow"("coachProfileId");
CREATE INDEX IF NOT EXISTS "CoachFollow_userId_idx" ON "CoachFollow"("userId");

ALTER TABLE "CoachFollow"
  ADD CONSTRAINT "CoachFollow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoachFollow"
  ADD CONSTRAINT "CoachFollow_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
