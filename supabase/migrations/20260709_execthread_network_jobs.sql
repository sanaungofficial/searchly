-- ExecThread network job source + multi-source NetworkJob keys

CREATE TYPE "NetworkJobSource" AS ENUM ('TOPECHELON', 'EXECTHREAD');

DO $$ BEGIN
  ALTER TYPE "ExternalApiProvider" ADD VALUE IF NOT EXISTS 'EXECTHREAD';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ExecThreadSession" (
  "id" TEXT NOT NULL,
  "cookies" JSONB NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExecThreadSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NetworkJob"
  ADD COLUMN IF NOT EXISTS "source" "NetworkJobSource" NOT NULL DEFAULT 'TOPECHELON',
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;

UPDATE "NetworkJob" SET "source" = 'TOPECHELON' WHERE "source" IS NULL;

DROP INDEX IF EXISTS "NetworkJob_externalId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "NetworkJob_source_externalId_key"
  ON "NetworkJob"("source", "externalId");

CREATE INDEX IF NOT EXISTS "NetworkJob_source_idx" ON "NetworkJob"("source");
