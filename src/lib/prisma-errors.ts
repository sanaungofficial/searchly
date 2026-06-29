import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

/** SQL migration that creates ImportRun + ImportRunStatus for import history. */
export const IMPORT_RUN_MIGRATION = "supabase/migrations/20260725_import_runs.sql";

/** True when Postgres/Prisma reports a missing table, column, or enum used by ImportRun. */
export function isPrismaMissingRelationError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code === "P2021" || err.code === "P2022") return true;
  if (err.code === "P2010") {
    const msg = String(err.meta?.message ?? err.message);
    return /does not exist/i.test(msg);
  }
  return false;
}

export function importRunUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: `Import history is not available yet. Apply the database migration: ${IMPORT_RUN_MIGRATION}`,
      code: "IMPORT_HISTORY_UNAVAILABLE",
    },
    { status: 503 },
  );
}
