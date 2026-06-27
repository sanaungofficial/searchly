ALTER TABLE "InboxContact" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "InboxContact" ADD COLUMN IF NOT EXISTS "statusUpdatedAt" TIMESTAMP(3);
ALTER TABLE "InboxContact" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

UPDATE "InboxContact" c
SET "lastActivityAt" = sub.max_at
FROM (
  SELECT "contactId", MAX("occurredAt") AS max_at
  FROM "InboxActivity"
  WHERE "contactId" IS NOT NULL
  GROUP BY "contactId"
) sub
WHERE c.id = sub."contactId";

UPDATE "InboxContact" SET "status" = 'new' WHERE "status" IS NULL;

CREATE INDEX IF NOT EXISTS "InboxContact_userId_status_idx" ON "InboxContact"("userId", "status");
CREATE INDEX IF NOT EXISTS "InboxContact_userId_lastActivityAt_idx" ON "InboxContact"("userId", "lastActivityAt");
