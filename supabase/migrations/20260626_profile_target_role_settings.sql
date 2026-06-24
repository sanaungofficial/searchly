ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "targetRoleSettings" JSONB;
