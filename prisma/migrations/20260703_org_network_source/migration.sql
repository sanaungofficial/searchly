-- CreateEnum
CREATE TYPE "NetworkPoolVisibility" AS ENUM ('PRIVATE', 'POOLED');

-- CreateEnum
CREATE TYPE "NetworkSourceStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "OrgNetworkSource" (
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

-- CreateIndex
CREATE UNIQUE INDEX "OrgNetworkSource_orgMemberId_key" ON "OrgNetworkSource"("orgMemberId");

-- CreateIndex
CREATE INDEX "OrgNetworkSource_nylasGrantId_idx" ON "OrgNetworkSource"("nylasGrantId");

-- CreateIndex
CREATE INDEX "OrgNetworkSource_status_idx" ON "OrgNetworkSource"("status");

-- CreateIndex
CREATE INDEX "OrgNetworkSource_visibility_idx" ON "OrgNetworkSource"("visibility");

-- AddForeignKey
ALTER TABLE "OrgNetworkSource" ADD CONSTRAINT "OrgNetworkSource_orgMemberId_fkey" FOREIGN KEY ("orgMemberId") REFERENCES "OrgMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgNetworkSource" ADD CONSTRAINT "OrgNetworkSource_userEmailGrantId_fkey" FOREIGN KEY ("userEmailGrantId") REFERENCES "UserEmailGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
