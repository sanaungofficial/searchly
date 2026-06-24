-- Target role fit analyses, upskilling skill goals, and course progress (Profile JSON fields)

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "roleAnalyses" JSONB,
  ADD COLUMN IF NOT EXISTS "skillGoals" JSONB,
  ADD COLUMN IF NOT EXISTS "upskillProgress" JSONB;
