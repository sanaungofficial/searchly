-- Coach-created webinars: format, approval workflow, co-hosts

CREATE TYPE "LiveSessionFormat" AS ENUM ('INTERACTIVE', 'BROADCAST');

ALTER TYPE "LiveSessionStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL' BEFORE 'SCHEDULED';

ALTER TABLE "LiveSession"
  ADD COLUMN IF NOT EXISTS "format" "LiveSessionFormat" NOT NULL DEFAULT 'INTERACTIVE',
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "replayEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedForApprovalAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

ALTER TABLE "LiveSession" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE TABLE IF NOT EXISTS "LiveSessionCoHost" (
  "id" TEXT NOT NULL,
  "liveSessionId" TEXT NOT NULL,
  "coachProfileId" TEXT,
  "displayName" TEXT NOT NULL,
  "email" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveSessionCoHost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LiveSessionCoHost_liveSessionId_idx" ON "LiveSessionCoHost"("liveSessionId");
CREATE INDEX IF NOT EXISTS "LiveSessionCoHost_coachProfileId_idx" ON "LiveSessionCoHost"("coachProfileId");

ALTER TABLE "LiveSessionCoHost"
  ADD CONSTRAINT "LiveSessionCoHost_liveSessionId_fkey"
  FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveSessionCoHost"
  ADD CONSTRAINT "LiveSessionCoHost_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
