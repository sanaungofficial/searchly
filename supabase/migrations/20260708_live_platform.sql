-- Live platform: analytics events, metrics, recording fields

CREATE TYPE "LiveSessionEventType" AS ENUM (
  'REGISTERED',
  'REMINDER_SENT',
  'LIVE_NOW_SENT',
  'FOLLOWER_NOTIFIED',
  'JOINED',
  'LEFT',
  'RECORDING_STARTED',
  'RECORDING_READY',
  'POST_SESSION_SENT',
  'SESSION_STARTED',
  'SESSION_ENDED',
  'PEER_REMOVED'
);

ALTER TABLE "LiveSession"
  ADD COLUMN IF NOT EXISTS "postSessionEmailSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followNotifySentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "peakViewers" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalUniqueJoins" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "recordingUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "recordingReadyAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hmsRecordingId" TEXT,
  ADD COLUMN IF NOT EXISTS "hmsLiveStreamId" TEXT,
  ADD COLUMN IF NOT EXISTS "hlsPlaybackUrl" TEXT;

CREATE TABLE IF NOT EXISTS "LiveSessionEvent" (
  "id" TEXT NOT NULL,
  "liveSessionId" TEXT NOT NULL,
  "userId" TEXT,
  "type" "LiveSessionEventType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveSessionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiveSessionEvent_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LiveSessionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LiveSessionEvent_liveSessionId_type_idx" ON "LiveSessionEvent"("liveSessionId", "type");
CREATE INDEX IF NOT EXISTS "LiveSessionEvent_liveSessionId_createdAt_idx" ON "LiveSessionEvent"("liveSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "LiveSessionEvent_userId_idx" ON "LiveSessionEvent"("userId");
