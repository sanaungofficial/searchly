-- Inbox CRM: contacts + rule-based activity log (all mail/meetings, no AI on ingest)

CREATE TYPE "InboxContactSource" AS ENUM ('EMAIL', 'NYLAS', 'MANUAL');
CREATE TYPE "InboxActivityKind" AS ENUM ('EMAIL', 'MEETING');
CREATE TYPE "InboxActivityDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "InboxActivityCategory" AS ENUM (
  'NEWSLETTER',
  'AUTOMATED',
  'RECRUITER',
  'JOB_SEARCH',
  'PERSONAL',
  'UNKNOWN'
);

CREATE TABLE IF NOT EXISTS "InboxContact" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "company" TEXT,
  "title" TEXT,
  "nylasContactId" TEXT,
  "source" "InboxContactSource" NOT NULL DEFAULT 'EMAIL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InboxContact_userId_email_key" ON "InboxContact"("userId", "email");
CREATE INDEX IF NOT EXISTS "InboxContact_userId_idx" ON "InboxContact"("userId");

ALTER TABLE "InboxContact"
  ADD CONSTRAINT "InboxContact_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "JobInboxContact" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "role" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobInboxContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobInboxContact_jobId_contactId_key"
  ON "JobInboxContact"("jobId", "contactId");
CREATE INDEX IF NOT EXISTS "JobInboxContact_userId_idx" ON "JobInboxContact"("userId");
CREATE INDEX IF NOT EXISTS "JobInboxContact_contactId_idx" ON "JobInboxContact"("contactId");

ALTER TABLE "JobInboxContact"
  ADD CONSTRAINT "JobInboxContact_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobInboxContact"
  ADD CONSTRAINT "JobInboxContact_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "InboxContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "InboxActivity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "InboxActivityKind" NOT NULL,
  "direction" "InboxActivityDirection" NOT NULL,
  "category" "InboxActivityCategory" NOT NULL DEFAULT 'UNKNOWN',
  "contactId" TEXT,
  "jobId" TEXT,
  "nylasMessageId" TEXT,
  "nylasEventId" TEXT,
  "nylasThreadId" TEXT,
  "subject" TEXT,
  "snippet" TEXT,
  "userTag" TEXT,
  "occurredAt" TIMESTAMP(3),
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InboxActivity_userId_nylasMessageId_key"
  ON "InboxActivity"("userId", "nylasMessageId");
CREATE UNIQUE INDEX IF NOT EXISTS "InboxActivity_userId_nylasEventId_key"
  ON "InboxActivity"("userId", "nylasEventId");
CREATE INDEX IF NOT EXISTS "InboxActivity_userId_occurredAt_idx" ON "InboxActivity"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "InboxActivity_userId_contactId_idx" ON "InboxActivity"("userId", "contactId");
CREATE INDEX IF NOT EXISTS "InboxActivity_userId_category_idx" ON "InboxActivity"("userId", "category");

ALTER TABLE "InboxActivity"
  ADD CONSTRAINT "InboxActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxActivity"
  ADD CONSTRAINT "InboxActivity_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "InboxContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboxActivity"
  ADD CONSTRAINT "InboxActivity_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
