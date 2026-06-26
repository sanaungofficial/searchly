CREATE TABLE IF NOT EXISTS "CoachSharedDocument" (
  "id" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "clientUserId" TEXT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "type" "AssetType" NOT NULL,
  "name" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachSharedDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CoachSharedDocument_clientUserId_idx" ON "CoachSharedDocument"("clientUserId");
CREATE INDEX IF NOT EXISTS "CoachSharedDocument_coachProfileId_clientUserId_idx"
  ON "CoachSharedDocument"("coachProfileId", "clientUserId");

DO $$ BEGIN
  ALTER TABLE "CoachSharedDocument"
    ADD CONSTRAINT "CoachSharedDocument_coachProfileId_fkey"
    FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoachSharedDocument"
    ADD CONSTRAINT "CoachSharedDocument_clientUserId_fkey"
    FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoachSharedDocument"
    ADD CONSTRAINT "CoachSharedDocument_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
