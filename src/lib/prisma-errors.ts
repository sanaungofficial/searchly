import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  IMPORT_HISTORY_UNAVAILABLE_CODE,
  IMPORT_RUN_MIGRATION,
  IMPORT_RUN_MIGRATION_GITHUB_URL,
} from "@/lib/client-import/import-history-constants";

export {
  IMPORT_HISTORY_UNAVAILABLE_CODE,
  IMPORT_RUN_MIGRATION,
  IMPORT_RUN_MIGRATION_GITHUB_URL,
} from "@/lib/client-import/import-history-constants";

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
      error:
        "Import history is not available yet. A one-time database migration is required in Supabase SQL Editor.",
      code: IMPORT_HISTORY_UNAVAILABLE_CODE,
      migrationPath: IMPORT_RUN_MIGRATION,
      migrationUrl: IMPORT_RUN_MIGRATION_GITHUB_URL,
    },
    { status: 503 },
  );
}
