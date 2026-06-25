-- External API usage logging (HireBase, Apify, etc.) for admin cost tracking

CREATE TYPE "ExternalApiProvider" AS ENUM ('HIREBASE', 'APIFY', 'TOPECHELON');

CREATE TABLE "ExternalApiUsageLog" (
  "id" TEXT NOT NULL,
  "provider" "ExternalApiProvider" NOT NULL,
  "operation" TEXT NOT NULL,
  "userId" TEXT,
  "units" INTEGER NOT NULL DEFAULT 1,
  "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalApiUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExternalApiUsageLog_provider_idx" ON "ExternalApiUsageLog"("provider");
CREATE INDEX "ExternalApiUsageLog_createdAt_idx" ON "ExternalApiUsageLog"("createdAt");
CREATE INDEX "ExternalApiUsageLog_userId_idx" ON "ExternalApiUsageLog"("userId");
