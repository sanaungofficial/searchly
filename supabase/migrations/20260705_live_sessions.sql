-- Live sessions (100ms webinar-style) + attendee registrations

CREATE TYPE "LiveSessionStatus" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'LIVE',
  'ENDED',
  'CANCELLED'
);

CREATE TABLE IF NOT EXISTS "LiveSession" (
  "id" TEXT NOT NULL,
  "legacyNumericId" INTEGER,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "coachProfileId" TEXT,
  "hostName" TEXT NOT NULL,
  "hostInitials" TEXT,
  "hostRole" TEXT,
  "hostRating" DOUBLE PRECISION,
  "hostReviewCount" INTEGER NOT NULL DEFAULT 0,
  "scheduledStart" TIMESTAMP(3) NOT NULL,
  "scheduledEnd" TIMESTAMP(3) NOT NULL,
  "status" "LiveSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "isFeaturedWeekly" BOOLEAN NOT NULL DEFAULT false,
  "bgColor" TEXT NOT NULL DEFAULT '#1A3A2F',
  "accentColor" TEXT NOT NULL DEFAULT '#E8D5A3',
  "hmsRoomId" TEXT,
  "wentLiveAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveSession_legacyNumericId_key"
  ON "LiveSession" ("legacyNumericId")
  WHERE "legacyNumericId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "LiveSession_status_idx" ON "LiveSession" ("status");
CREATE INDEX IF NOT EXISTS "LiveSession_scheduledStart_idx" ON "LiveSession" ("scheduledStart");
CREATE INDEX IF NOT EXISTS "LiveSession_coachProfileId_idx" ON "LiveSession" ("coachProfileId");

ALTER TABLE "LiveSession"
  ADD CONSTRAINT "LiveSession_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "CoachProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "LiveSessionRegistration" (
  "id" TEXT NOT NULL,
  "liveSessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveSessionRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveSessionRegistration_liveSessionId_userId_key"
  ON "LiveSessionRegistration" ("liveSessionId", "userId");

CREATE INDEX IF NOT EXISTS "LiveSessionRegistration_userId_idx"
  ON "LiveSessionRegistration" ("userId");

ALTER TABLE "LiveSessionRegistration"
  ADD CONSTRAINT "LiveSessionRegistration_liveSessionId_fkey"
  FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveSessionRegistration"
  ADD CONSTRAINT "LiveSessionRegistration_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed catalog (matches former static LIVE_SESSIONS; legacyNumericId keeps existing 100ms rooms)
INSERT INTO "LiveSession" (
  "id", "legacyNumericId", "title", "description", "category",
  "hostName", "hostInitials", "hostRole", "hostRating", "hostReviewCount",
  "scheduledStart", "scheduledEnd", "status", "isFeaturedWeekly", "bgColor", "accentColor"
) VALUES
(
  'live_seed_weekly_qa', 0,
  'Job Search Strategy: Weekly Q&A',
  'Open Q&A on job search tactics, positioning, and getting in front of the right people. Mira covers what''s actually working right now — from resume framing to outreach scripts to navigating the ATS.',
  'Job Search',
  'Mira Singh', 'MS', 'Career Coach · Second Ladder', 4.9, 142,
  '2026-06-25 16:00:00', '2026-06-25 17:00:00', 'SCHEDULED', true, '#1A3A2F', '#E8D5A3'
),
(
  'live_seed_pm_director', 1,
  'Senior PM → Director: What Actually Changes',
  'The jump from Senior PM to Director isn''t about doing more — it''s about doing different. Rachel breaks down exactly what hiring managers screen for at this level.',
  'Career Transition',
  'Rachel Torres', 'RT', 'PM Career Specialist · ex-Meta', 4.9, 48,
  '2026-06-26 19:00:00', '2026-06-26 20:00:00', 'SCHEDULED', false, '#2D1F52', '#C4B8E8'
),
(
  'live_seed_resume', 2,
  'How Stripe and Linear Actually Read Your Resume',
  'An insider look at how top-tier tech companies parse resumes before a human ever sees them — and what you can change this week to get through.',
  'Resume',
  'Michael Chen', 'MC', 'Tech Recruiter · ex-Google', 4.8, 31,
  '2026-06-27 15:00:00', '2026-06-27 15:45:00', 'SCHEDULED', false, '#1A2E4A', '#B8D4E8'
),
(
  'live_seed_interviews', 3,
  'Director-Track Interviews: What MBB Actually Looks For',
  'Live mock interview debrief. Jeremy walks through the most common failure modes for senior candidates transitioning to Director-level and how to avoid them.',
  'Interviews',
  'Jeremy Scharf', 'JS', 'ex-Bain Interviewer · MBB Case Expert', 5.0, 160,
  '2026-06-28 18:00:00', '2026-06-28 19:00:00', 'SCHEDULED', false, '#3A1A1A', '#E8C4B8'
),
(
  'live_seed_negotiation', 4,
  'The Offer Negotiation Playbook: Getting to Yes',
  'A live walkthrough of the exact scripts and frameworks Mira uses with clients to negotiate compensation packages — including base, equity, and signing.',
  'Negotiation',
  'Mira Singh', 'MS', 'Career Coach · Second Ladder', 4.9, 142,
  '2026-06-23 18:30:00', '2026-06-23 19:15:00', 'LIVE', false, '#1A3A2F', '#E8D5A3'
)
ON CONFLICT ("id") DO NOTHING;
