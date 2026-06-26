-- Kimchi assistant conversation threads
CREATE TABLE IF NOT EXISTS "AssistantThread" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'New chat',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'text',
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AssistantThread_userId_updatedAt_idx" ON "AssistantThread"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "AssistantMessage_threadId_createdAt_idx" ON "AssistantMessage"("threadId", "createdAt");

ALTER TABLE "AssistantThread"
  ADD CONSTRAINT "AssistantThread_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantMessage"
  ADD CONSTRAINT "AssistantMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
