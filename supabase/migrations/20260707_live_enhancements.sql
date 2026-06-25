-- Remove RECRUITER role (migrate to COACH), link live sessions to coach profiles, email tracking

UPDATE "User" SET role = 'COACH' WHERE role = 'RECRUITER';

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('USER', 'COACH', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN role DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN role TYPE "UserRole" USING (role::text::"UserRole");
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'USER';
DROP TYPE "UserRole_old";

-- Link seeded live sessions to CoachProfile by host name
UPDATE "LiveSession" ls
SET "coachProfileId" = cp.id
FROM "CoachProfile" cp
WHERE ls."coachProfileId" IS NULL
  AND lower(trim(ls."hostName")) = lower(trim(cp."displayName"));

ALTER TABLE "LiveSession"
  ADD COLUMN IF NOT EXISTS "liveNowEmailSentAt" TIMESTAMP(3);

ALTER TABLE "LiveSessionRegistration"
  ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
