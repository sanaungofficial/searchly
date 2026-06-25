-- Top Echelon network job sync tables (Prisma: TopEchelonSession, NetworkRecruiter, NetworkJob)

CREATE TABLE IF NOT EXISTS "TopEchelonSession" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "cookies" JSONB NOT NULL,
  "tokenPayload" JSONB,
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TopEchelonSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetworkRecruiter" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "agencyName" TEXT,
  "raw" JSONB NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NetworkRecruiter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NetworkRecruiter_externalId_key" ON "NetworkRecruiter"("externalId");
CREATE INDEX IF NOT EXISTS "NetworkRecruiter_name_idx" ON "NetworkRecruiter"("name");
CREATE INDEX IF NOT EXISTS "NetworkRecruiter_agencyName_idx" ON "NetworkRecruiter"("agencyName");

CREATE TABLE IF NOT EXISTS "NetworkJob" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "networkId" TEXT,
  "positionTitle" TEXT NOT NULL,
  "companyName" TEXT,
  "city" TEXT,
  "state" TEXT,
  "location" TEXT,
  "minimumCompensation" INTEGER,
  "maximumCompensation" INTEGER,
  "fee" TEXT,
  "feeType" TEXT,
  "jobType" TEXT,
  "remoteOption" TEXT,
  "description" TEXT,
  "comments" TEXT,
  "networkStatus" TEXT,
  "recruiterName" TEXT,
  "recruiterId" TEXT,
  "topEchelonUrl" TEXT,
  "sharedAt" TIMESTAMP(3),
  "raw" JSONB NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recruiterRecordId" TEXT,
  CONSTRAINT "NetworkJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NetworkJob_recruiterRecordId_fkey" FOREIGN KEY ("recruiterRecordId") REFERENCES "NetworkRecruiter"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "NetworkJob_externalId_key" ON "NetworkJob"("externalId");
CREATE INDEX IF NOT EXISTS "NetworkJob_sharedAt_idx" ON "NetworkJob"("sharedAt");
CREATE INDEX IF NOT EXISTS "NetworkJob_networkStatus_idx" ON "NetworkJob"("networkStatus");
CREATE INDEX IF NOT EXISTS "NetworkJob_recruiterRecordId_idx" ON "NetworkJob"("recruiterRecordId");
