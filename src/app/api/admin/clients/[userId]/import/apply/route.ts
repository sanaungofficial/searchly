import { getActingUser, canAccessAdminClientTools } from "@/lib/acting-user";
import { resolveAdminClientSubject, readClientUserIdFromRequest } from "@/lib/admin-client-subject";
import { applyClientImport } from "@/lib/client-import/apply";
import { recordImportRun } from "@/lib/client-import/import-run";
import type { ClientImportApplyPayload } from "@/lib/client-import/types";
import { NextResponse } from "next/server";

export const maxDuration = 300;

type RouteParams = { params: Promise<{ userId: string }> };

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

  let body: ClientImportApplyPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.preview) {
    return NextResponse.json({ error: "preview is required" }, { status: 400 });
  }

  try {
    const profileSelection = body.profile ?? {};
    const targetRoles =
      body.profile?.targetRoles ??
      body.preview.profile.targetRoles.filter((r) => r.selected).map((r) => r.data);
    const deprioritizedRoles =
      body.profile?.deprioritizedRoles ??
      body.preview.profile.deprioritizedRoles.filter((r) => r.selected).map((r) => r.data);
    const prioritizedCategories =
      body.profile?.prioritizedCategories ??
      (body.preview.profile.prioritizedCategories ?? []).filter((r) => r.selected).map((r) => r.data);
    const deprioritizedCategories =
      body.profile?.deprioritizedCategories ??
      (body.preview.profile.deprioritizedCategories ?? []).filter((r) => r.selected).map((r) => r.data);

    const result = await applyClientImport(dbUser.id, {
      preview: body.preview,
      profile: {
        ...profileSelection,
        targetRoles,
        deprioritizedRoles,
        prioritizedCategories,
        deprioritizedCategories,
        searchDuration: profileSelection.searchDuration ?? body.preview.profile.searchDuration,
        avoidNotes: profileSelection.avoidNotes ?? body.preview.profile.avoidNotes,
        proposed: profileSelection.proposed ?? body.preview.profile.proposed,
      },
      pipelineJobIds:
        body.pipelineJobIds ??
        body.preview.pipelineJobs.filter((r) => r.selected).map((r) => r.id),
      companyIds:
        body.companyIds ?? body.preview.companies.filter((r) => r.selected).map((r) => r.id),
      contactIds:
        body.contactIds ?? body.preview.contacts.filter((r) => r.selected).map((r) => r.id),
      applicationQaIds:
        body.applicationQaIds ??
        (body.preview.applicationQa ?? []).filter((r) => r.selected).map((r) => r.id),
      applyResume: body.applyResume === true,
      jobImportOptions: body.jobImportOptions,
    });

    let runId: string | undefined;
    if (acting.realDbUser) {
      try {
        const run = await recordImportRun({
          clientUserId: dbUser.id,
          importedById: acting.realDbUser.id,
          meta: body.importMeta ?? {},
          preview: body.preview,
          result,
        });
        runId = run.id;
      } catch (recordErr) {
        console.error("[admin import apply] failed to record ImportRun", recordErr);
      }
    }

    return NextResponse.json({ ...result, runId });
  } catch (err) {
    console.error("[admin import apply]", err);
    const message = err instanceof Error ? err.message : "Import apply failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
