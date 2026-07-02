-- Enterprise org membership (Step 1)

DO $$ BEGIN
  CREATE TYPE "OrgMemberRole" AS ENUM ('ADMIN', 'MEMBER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Org" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "website" TEXT,
  "logoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Org_slug_key" ON "Org"("slug");

CREATE TABLE IF NOT EXISTS "OrgMember" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrgMemberRole" NOT NULL DEFAULT 'MEMBER',
  "invitedByUserId" TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrgMember_userId_idx" ON "OrgMember"("userId");
CREATE INDEX IF NOT EXISTS "OrgMember_orgId_idx" ON "OrgMember"("orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "OrgMember_orgId_userId_key" ON "OrgMember"("orgId", "userId");

DO $$ BEGIN
  ALTER TABLE "OrgMember"
    ADD CONSTRAINT "OrgMember_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrgMember"
    ADD CONSTRAINT "OrgMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrgMember"
    ADD CONSTRAINT "OrgMember_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
