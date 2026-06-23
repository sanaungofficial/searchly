-- P2: shared CompanyIntel catalog + link from user watchlists

ALTER TABLE "CompanyIntel"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "careersUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "jobsCache" JSONB,
  ADD COLUMN IF NOT EXISTS "lastJobsFetchedAt" TIMESTAMP(3);

UPDATE "CompanyIntel"
SET "slug" = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyIntel_slug_key" ON "CompanyIntel"("slug");

ALTER TABLE "TrackedCompany"
  ADD COLUMN IF NOT EXISTS "companyIntelId" TEXT;

CREATE INDEX IF NOT EXISTS "TrackedCompany_companyIntelId_idx" ON "TrackedCompany"("companyIntelId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrackedCompany_companyIntelId_fkey'
  ) THEN
    ALTER TABLE "TrackedCompany"
      ADD CONSTRAINT "TrackedCompany_companyIntelId_fkey"
      FOREIGN KEY ("companyIntelId") REFERENCES "CompanyIntel"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill intel rows for existing tracked companies (one canonical row per slug)
INSERT INTO "CompanyIntel" (id, name, slug, website, "careersUrl", "jobsCache", "lastJobsFetchedAt", "enrichmentCache", "enrichmentFetchedAt", "createdAt", "updatedAt")
SELECT
  'ci_' || substr(md5(grouped.slug), 1, 24),
  grouped.display_name,
  grouped.slug,
  grouped.website,
  grouped.careers_url,
  grouped.jobs_cache,
  grouped.last_jobs_fetched_at,
  grouped.enrichment_cache,
  grouped.enrichment_fetched_at,
  NOW(),
  NOW()
FROM (
  SELECT
    lower(regexp_replace(trim(tc.name), '[^a-zA-Z0-9]+', '-', 'g')) AS slug,
    max(tc.name) AS display_name,
    max(tc.website) AS website,
    max(tc."careersUrl") AS careers_url,
    (array_agg(tc."jobsCache" ORDER BY tc."lastJobsFetchedAt" DESC NULLS LAST))[1] AS jobs_cache,
    max(tc."lastJobsFetchedAt") AS last_jobs_fetched_at,
    (array_agg(tc."enrichmentCache" ORDER BY tc."enrichmentFetchedAt" DESC NULLS LAST))[1] AS enrichment_cache,
    max(tc."enrichmentFetchedAt") AS enrichment_fetched_at
  FROM "TrackedCompany" tc
  GROUP BY 1
) grouped
ON CONFLICT ("slug") DO UPDATE SET
  website = COALESCE("CompanyIntel".website, EXCLUDED.website),
  "careersUrl" = COALESCE("CompanyIntel"."careersUrl", EXCLUDED."careersUrl"),
  "jobsCache" = COALESCE("CompanyIntel"."jobsCache", EXCLUDED."jobsCache"),
  "lastJobsFetchedAt" = COALESCE("CompanyIntel"."lastJobsFetchedAt", EXCLUDED."lastJobsFetchedAt"),
  "enrichmentCache" = COALESCE("CompanyIntel"."enrichmentCache", EXCLUDED."enrichmentCache"),
  "enrichmentFetchedAt" = COALESCE("CompanyIntel"."enrichmentFetchedAt", EXCLUDED."enrichmentFetchedAt"),
  "updatedAt" = NOW();

UPDATE "TrackedCompany" tc
SET "companyIntelId" = ci.id
FROM "CompanyIntel" ci
WHERE tc."companyIntelId" IS NULL
  AND ci.slug = lower(regexp_replace(trim(tc.name), '[^a-zA-Z0-9]+', '-', 'g'));
