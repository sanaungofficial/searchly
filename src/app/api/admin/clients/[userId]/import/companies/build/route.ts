import { getActingUser, canAccessAdminClientTools } from "@/lib/acting-user";
import { resolveAdminClientSubject, readClientUserIdFromRequest } from "@/lib/admin-client-subject";
import {
  buildCompaniesImportPreview,
  type CompaniesColumnMapping,
  type CompaniesSheetPreview,
} from "@/lib/client-import/company-field-mapping";
import type { ClientImportPreview } from "@/lib/client-import/types";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ userId: string }> };

type BuildBody = {
  sheetPreview: CompaniesSheetPreview;
  columns: CompaniesColumnMapping[];
  includeUnmappedInNotes?: boolean;
};

export async function POST(request: Request, { params }: RouteParams) {
  const acting = await getActingUser(request);
  if (!acting.authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdminClientTools(acting)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId: pathUserId } = await params;
  const clientUserId = readClientUserIdFromRequest(request) ?? pathUserId;
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return resolved.error;
  const dbUser = resolved.subject;
  if (!dbUser || dbUser.id !== pathUserId) {
    return NextResponse.json({ error: "Client mismatch" }, { status: 400 });
  }

  let body: BuildBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sheetPreview || !body.columns) {
    return NextResponse.json({ error: "sheetPreview and columns are required" }, { status: 400 });
  }

  try {
    const { companies, warnings, mappingRecommendation } = buildCompaniesImportPreview(
      body.sheetPreview,
      body.columns,
      body.includeUnmappedInNotes !== false,
    );

    const preview: ClientImportPreview = {
      sourceFiles: [{ filename: body.sheetPreview.filename, kind: "target_companies" }],
      profile: {
        targetRoles: [],
        deprioritizedRoles: [],
        searchDuration: null,
        avoidNotes: null,
        proposed: {},
      },
      pipelineJobs: [],
      companies,
      contacts: [],
      referenceDocuments: [],
      warnings,
      mappingRecommendation,
    };

    return NextResponse.json({ preview, mappingRecommendation });
  } catch (err) {
    console.error("[companies import build]", err);
    const message = err instanceof Error ? err.message : "Failed to build import preview";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
