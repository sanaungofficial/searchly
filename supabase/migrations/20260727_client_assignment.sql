-- Polymorphic client assignment (Enterprise Step 2)

DO $$ BEGIN
  CREATE TYPE "AssignmentAssignerType" AS ENUM ('COACH', 'COMPANY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClientAssignment" (
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

CREATE INDEX IF NOT EXISTS "ClientAssignment_clientId_idx" ON "ClientAssignment"("clientId");
CREATE INDEX IF NOT EXISTS "ClientAssignment_coachProfileId_idx" ON "ClientAssignment"("coachProfileId");
CREATE INDEX IF NOT EXISTS "ClientAssignment_orgId_idx" ON "ClientAssignment"("orgId");

CREATE UNIQUE INDEX IF NOT EXISTS "ClientAssignment_clientId_assignerType_coachProfileId_key"
  ON "ClientAssignment"("clientId", "assignerType", "coachProfileId");

CREATE UNIQUE INDEX IF NOT EXISTS "ClientAssignment_clientId_assignerType_orgId_key"
  ON "ClientAssignment"("clientId", "assignerType", "orgId");

DO $$ BEGIN
  ALTER TABLE "ClientAssignment"
    ADD CONSTRAINT "ClientAssignment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClientAssignment"
    ADD CONSTRAINT "ClientAssignment_coachProfileId_fkey"
    FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClientAssignment"
    ADD CONSTRAINT "ClientAssignment_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClientAssignment"
    ADD CONSTRAINT "ClientAssignment_assignedByUserId_fkey"
    FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill coach rows from legacy CoachClientAssignment (idempotent)
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
