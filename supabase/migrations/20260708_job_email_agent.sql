-- Job-search email agent: user grants, settings, activity log, Kimchi agent account

CREATE TYPE "JobActivitySource" AS ENUM ('EMAIL', 'CALENDAR', 'KIMCHI_AGENT');
CREATE TYPE "JobActivitySignal" AS ENUM (
  'APPLICATION_RECEIVED',
  'INTERVIEW_INVITE',
  'REJECTION',
  'OFFER',
  'RECRUITER_OUTREACH',
  'FOLLOW_UP',
  'OTHER'
);
CREATE TYPE "JobActivityStatus" AS ENUM ('APPLIED', 'PENDING_REVIEW', 'DISMISSED', 'SKIPPED', 'FAILED');

ALTER TYPE "AiFeature" ADD VALUE IF NOT EXISTS 'EMAIL_JOB_SIGNAL';

CREATE TABLE IF NOT EXISTS "UserEmailGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nylasGrantId" TEXT NOT NULL,
  "email" TEXT,
  "provider" TEXT,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserEmailGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserEmailGrant_userId_key" ON "UserEmailGrant"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserEmailGrant_nylasGrantId_key" ON "UserEmailGrant"("nylasGrantId");
CREATE INDEX IF NOT EXISTS "UserEmailGrant_nylasGrantId_idx" ON "UserEmailGrant"("nylasGrantId");

ALTER TABLE "UserEmailGrant"
  ADD CONSTRAINT "UserEmailGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "UserJobAgentSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "autoApplyUpdates" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserJobAgentSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserJobAgentSettings_userId_key" ON "UserJobAgentSettings"("userId");

ALTER TABLE "UserJobAgentSettings"
  ADD CONSTRAINT "UserJobAgentSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "JobActivityLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobId" TEXT,
  "source" "JobActivitySource" NOT NULL,
  "signal" "JobActivitySignal" NOT NULL,
  "suggestedStage" "JobStage",
  "appliedStage" "JobStage",
  "status" "JobActivityStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "confidence" DOUBLE PRECISION,
  "title" TEXT,
  "snippet" TEXT,
  "companyGuess" TEXT,
  "roleGuess" TEXT,
  "nylasMessageId" TEXT,
  "nylasEventId" TEXT,
  "interviewAt" TIMESTAMP(3),
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobActivityLog_userId_nylasMessageId_key"
  ON "JobActivityLog"("userId", "nylasMessageId");
CREATE UNIQUE INDEX IF NOT EXISTS "JobActivityLog_userId_nylasEventId_key"
  ON "JobActivityLog"("userId", "nylasEventId");
CREATE INDEX IF NOT EXISTS "JobActivityLog_userId_createdAt_idx" ON "JobActivityLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "JobActivityLog_userId_status_idx" ON "JobActivityLog"("userId", "status");

ALTER TABLE "JobActivityLog"
  ADD CONSTRAINT "JobActivityLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobActivityLog"
  ADD CONSTRAINT "JobActivityLog_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "KimchiAgentAccount" (
  "id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "nylasGrantId" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KimchiAgentAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KimchiAgentAccount_purpose_key" ON "KimchiAgentAccount"("purpose");
CREATE UNIQUE INDEX IF NOT EXISTS "KimchiAgentAccount_email_key" ON "KimchiAgentAccount"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "KimchiAgentAccount_nylasGrantId_key" ON "KimchiAgentAccount"("nylasGrantId");
