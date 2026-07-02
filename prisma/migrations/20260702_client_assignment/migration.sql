-- CreateEnum
CREATE TYPE "AssignmentAssignerType" AS ENUM ('COACH', 'COMPANY');

-- CreateTable
CREATE TABLE "ClientAssignment" (
    "id" TEXT NOT NULL,
    "assignerType" "AssignmentAssignerType" NOT NULL,
    "clientId" TEXT NOT NULL,
    "coachProfileId" TEXT,
    "orgId" TEXT,
    "assignedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientAssignment_clientId_idx" ON "ClientAssignment"("clientId");

-- CreateIndex
CREATE INDEX "ClientAssignment_coachProfileId_idx" ON "ClientAssignment"("coachProfileId");

-- CreateIndex
CREATE INDEX "ClientAssignment_orgId_idx" ON "ClientAssignment"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAssignment_clientId_assignerType_coachProfileId_key" ON "ClientAssignment"("clientId", "assignerType", "coachProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAssignment_clientId_assignerType_orgId_key" ON "ClientAssignment"("clientId", "assignerType", "orgId");

-- AddForeignKey
ALTER TABLE "ClientAssignment" ADD CONSTRAINT "ClientAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAssignment" ADD CONSTRAINT "ClientAssignment_coachProfileId_fkey" FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAssignment" ADD CONSTRAINT "ClientAssignment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAssignment" ADD CONSTRAINT "ClientAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill coach assignments from legacy table
INSERT INTO "ClientAssignment" (
    "id",
    "assignerType",
    "clientId",
    "coachProfileId",
    "orgId",
    "assignedByUserId",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    'COACH'::"AssignmentAssignerType",
    "userId",
    "coachProfileId",
    NULL,
    "assignedByUserId",
    "notes",
    "createdAt",
    "updatedAt"
FROM "CoachClientAssignment"
ON CONFLICT ("id") DO NOTHING;
