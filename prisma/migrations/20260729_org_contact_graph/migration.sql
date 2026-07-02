-- CreateTable
CREATE TABLE "OrgContact" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "title" TEXT,
    "linkedinUrl" TEXT,
    "phone" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgContactKnownBy" (
    "id" TEXT NOT NULL,
    "orgContactId" TEXT NOT NULL,
    "networkSourceId" TEXT NOT NULL,
    "strengthScore" INTEGER NOT NULL DEFAULT 0,
    "strengthFactors" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgContactKnownBy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgContact_orgId_emailNormalized_key" ON "OrgContact"("orgId", "emailNormalized");

-- CreateIndex
CREATE INDEX "OrgContact_orgId_company_idx" ON "OrgContact"("orgId", "company");

-- CreateIndex
CREATE INDEX "OrgContact_orgId_idx" ON "OrgContact"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgContactKnownBy_orgContactId_networkSourceId_key" ON "OrgContactKnownBy"("orgContactId", "networkSourceId");

-- CreateIndex
CREATE INDEX "OrgContactKnownBy_networkSourceId_idx" ON "OrgContactKnownBy"("networkSourceId");

-- AddForeignKey
ALTER TABLE "OrgContact" ADD CONSTRAINT "OrgContact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgContactKnownBy" ADD CONSTRAINT "OrgContactKnownBy_orgContactId_fkey" FOREIGN KEY ("orgContactId") REFERENCES "OrgContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgContactKnownBy" ADD CONSTRAINT "OrgContactKnownBy_networkSourceId_fkey" FOREIGN KEY ("networkSourceId") REFERENCES "OrgNetworkSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
