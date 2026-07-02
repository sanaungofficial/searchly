-- Org intro match cache (Enterprise Step 6)

CREATE TABLE "OrgMatchResult" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "targetCompany" TEXT NOT NULL,
    "targetCompanyKey" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "strengthScore" INTEGER NOT NULL,
    "matchType" TEXT,
    "knownByUserId" TEXT,
    "knownByUserName" TEXT,
    "knownByNetworkSourceId" TEXT,
    "hirebaseJobIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hirebaseJobs" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgMatchResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgMatchResult_orgId_clientId_targetCompanyKey_contactId_key"
    ON "OrgMatchResult"("orgId", "clientId", "targetCompanyKey", "contactId");

CREATE INDEX "OrgMatchResult_orgId_clientId_idx"
    ON "OrgMatchResult"("orgId", "clientId");

CREATE INDEX "OrgMatchResult_orgId_clientId_strengthScore_idx"
    ON "OrgMatchResult"("orgId", "clientId", "strengthScore" DESC);

ALTER TABLE "OrgMatchResult" ADD CONSTRAINT "OrgMatchResult_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrgMatchResult" ADD CONSTRAINT "OrgMatchResult_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrgMatchResult" ADD CONSTRAINT "OrgMatchResult_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "OrgContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
