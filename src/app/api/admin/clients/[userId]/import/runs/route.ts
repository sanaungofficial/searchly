import { getActingUser, canAccessAdminClientTools } from "@/lib/acting-user";
import { resolveAdminClientSubject, readClientUserIdFromRequest } from "@/lib/admin-client-subject";
import {
  buildIntakeApplyResult,
  recordImportRun,
  serializeImportRunDetail,
  type ImportRunMeta,
} from "@/lib/client-import/import-run";
import type { ClientImportApplyResult } from "@/lib/client-import/types";
import { importRunUnavailableResponse, isPrismaMissingRelationError } from "@/lib/prisma-errors";
import { NextResponse } from "next/server";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ userId: string }> };

type RecordImportRunBody = {
  result?: ClientImportApplyResult;
  intake?: {
    profileUpdated?: boolean;
    companiesAdded?: number;
    companiesUpdated?: number;
    qaAdded?: number;
    qaSkipped?: number;
    errors?: string[];
  };
  importMeta: ImportRunMeta;
};

export async function POST(request: Request, { params }: RouteParams) {
  const acting = await getActingUser(request);
  if (!acting.authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdminClientTools(acting)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!acting.realDbUser) {
    return NextResponse.json({ error: "User record not found" }, { status: 401 });
  }

  const { userId: pathUserId } = await params;
  const clientUserId = readClientUserIdFromRequest(request) ?? pathUserId;
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return resolved.error;
  const dbUser = resolved.subject;
  if (!dbUser || dbUser.id !== pathUserId) {
    return NextResponse.json({ error: "Client mismatch" }, { status: 400 });
  }

  let body: RecordImportRunBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.importMeta?.importType || !body.importMeta?.sourceKind) {
    return NextResponse.json({ error: "importMeta.importType and importMeta.sourceKind are required" }, { status: 400 });
  }

  const result =
    body.result ??
    buildIntakeApplyResult({
      profileUpdated: body.intake?.profileUpdated ?? false,
      companiesAdded: body.intake?.companiesAdded ?? 0,
      companiesUpdated: body.intake?.companiesUpdated ?? 0,
      qaAdded: body.intake?.qaAdded ?? 0,
      qaSkipped: body.intake?.qaSkipped ?? 0,
      errors: body.intake?.errors,
    });

  try {
    const run = await recordImportRun({
      clientUserId: dbUser.id,
      importedById: acting.realDbUser.id,
      meta: body.importMeta,
      result,
    });

    const detail = serializeImportRunDetail({
      ...run,
      importedBy: acting.realDbUser,
    });

    return NextResponse.json({ run: detail, runId: run.id });
  } catch (err) {
    if (isPrismaMissingRelationError(err)) return importRunUnavailableResponse();
    console.error("[import runs record]", err);
    const message = err instanceof Error ? err.message : "Failed to record import run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
