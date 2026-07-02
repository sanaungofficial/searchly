-- Org intro tracking (Enterprise Step 7)

DO $$ BEGIN
  CREATE TYPE "OrgIntroTrackingStatus" AS ENUM ('REQUESTED', 'SENT', 'DONE', 'DECLINED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OrgIntroTracking" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "orgContactId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" "OrgIntroTrackingStatus" NOT NULL DEFAULT 'REQUESTED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrgIntroTracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgIntroTracking_orgId_clientId_orgContactId_key"
  ON "OrgIntroTracking"("orgId", "clientId", "orgContactId");

CREATE INDEX IF NOT EXISTS "OrgIntroTracking_orgId_clientId_idx"
  ON "OrgIntroTracking"("orgId", "clientId");

CREATE INDEX IF NOT EXISTS "OrgIntroTracking_orgId_status_idx"
  ON "OrgIntroTracking"("orgId", "status");

DO $$ BEGIN
  ALTER TABLE "OrgIntroTracking"
    ADD CONSTRAINT "OrgIntroTracking_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrgIntroTracking"
    ADD CONSTRAINT "OrgIntroTracking_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrgIntroTracking"
    ADD CONSTRAINT "OrgIntroTracking_orgContactId_fkey"
    FOREIGN KEY ("orgContactId") REFERENCES "OrgContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrgIntroTracking"
    ADD CONSTRAINT "OrgIntroTracking_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
