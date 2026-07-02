-- Org member network source (Enterprise Step 3)

DO $$ BEGIN
  CREATE TYPE "NetworkPoolVisibility" AS ENUM ('PRIVATE', 'POOLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NetworkSourceStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OrgNetworkSource" (
  "id" TEXT NOT NULL,
  "orgMemberId" TEXT NOT NULL,
  "userEmailGrantId" TEXT,
  "nylasGrantId" TEXT,
  "email" TEXT,
  "provider" TEXT,
  "visibility" "NetworkPoolVisibility" NOT NULL DEFAULT 'PRIVATE',
  "poolPolicy" JSONB,
  "status" "NetworkSourceStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "lastSyncAt" TIMESTAMP(3),
  "connectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrgNetworkSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgNetworkSource_orgMemberId_key"
  ON "OrgNetworkSource"("orgMemberId");

CREATE INDEX IF NOT EXISTS "OrgNetworkSource_nylasGrantId_idx"
  ON "OrgNetworkSource"("nylasGrantId");

CREATE INDEX IF NOT EXISTS "OrgNetworkSource_status_idx"
  ON "OrgNetworkSource"("status");

CREATE INDEX IF NOT EXISTS "OrgNetworkSource_visibility_idx"
  ON "OrgNetworkSource"("visibility");

DO $$ BEGIN
  ALTER TABLE "OrgNetworkSource"
    ADD CONSTRAINT "OrgNetworkSource_orgMemberId_fkey"
    FOREIGN KEY ("orgMemberId") REFERENCES "OrgMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrgNetworkSource"
    ADD CONSTRAINT "OrgNetworkSource_userEmailGrantId_fkey"
    FOREIGN KEY ("userEmailGrantId") REFERENCES "UserEmailGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
