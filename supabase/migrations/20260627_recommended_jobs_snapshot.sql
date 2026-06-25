-- Recommended jobs snapshot, global job cache, digest settings

CREATE TABLE IF NOT EXISTS "JobListingCache" (
  "id" TEXT NOT NULL,
  "hirebaseId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "companyName" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobListingCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobListingCache_hirebaseId_key" ON "JobListingCache"("hirebaseId");
CREATE INDEX IF NOT EXISTS "JobListingCache_fetchedAt_idx" ON "JobListingCache"("fetchedAt");

CREATE TABLE IF NOT EXISTS "RecommendedJobSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "snapshotDate" TEXT NOT NULL,
  "jobs" JSONB NOT NULL,
  "matchMode" TEXT NOT NULL,
  "companyCount" INTEGER NOT NULL DEFAULT 0,
  "trackedWithMatches" INTEGER NOT NULL DEFAULT 0,
  "jobCount" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "manualRefresh" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "RecommendedJobSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecommendedJobSnapshot_userId_snapshotDate_key"
  ON "RecommendedJobSnapshot"("userId", "snapshotDate");
CREATE INDEX IF NOT EXISTS "RecommendedJobSnapshot_userId_idx" ON "RecommendedJobSnapshot"("userId");
CREATE INDEX IF NOT EXISTS "RecommendedJobSnapshot_snapshotDate_idx" ON "RecommendedJobSnapshot"("snapshotDate");

ALTER TABLE "RecommendedJobSnapshot"
  ADD CONSTRAINT "RecommendedJobSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "UserDigestSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dailyEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastDigestSentAt" TIMESTAMP(3),
  "lastDigestJobIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lastManualRefreshAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDigestSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserDigestSettings_userId_key" ON "UserDigestSettings"("userId");

ALTER TABLE "UserDigestSettings"
  ADD CONSTRAINT "UserDigestSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
