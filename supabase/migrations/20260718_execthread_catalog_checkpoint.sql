-- ExecThread paginated catalog import checkpoint (US/CA bulk sync)

ALTER TABLE "ExecThreadSession"
  ADD COLUMN IF NOT EXISTS "catalogImportFrom" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "catalogImportTotalHits" INTEGER,
  ADD COLUMN IF NOT EXISTS "catalogImportComplete" BOOLEAN NOT NULL DEFAULT false;
