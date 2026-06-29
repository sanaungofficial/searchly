-- Persist admin/client import runs for history and completion screens
CREATE TYPE "ImportRunStatus" AS ENUM ('SUCCESS', 'SOME_FAILURES', 'FAILED');

CREATE TABLE "ImportRun" (
  "id" TEXT NOT NULL,
  "clientUserId" TEXT NOT NULL,
  "importedById" TEXT NOT NULL,
  "importType" TEXT NOT NULL,
  "fileName" TEXT,
  "sourceKind" TEXT NOT NULL,
  "status" "ImportRunStatus" NOT NULL,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "resultSnapshot" JSONB NOT NULL,
  "errorDetails" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportRun_clientUserId_createdAt_idx" ON "ImportRun"("clientUserId", "createdAt" DESC);
CREATE INDEX "ImportRun_importedById_idx" ON "ImportRun"("importedById");

ALTER TABLE "ImportRun"
  ADD CONSTRAINT "ImportRun_clientUserId_fkey"
  FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportRun"
  ADD CONSTRAINT "ImportRun_importedById_fkey"
  FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
