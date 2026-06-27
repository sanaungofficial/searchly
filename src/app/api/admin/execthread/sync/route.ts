import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { execthreadConfigured } from "@/lib/execthread/client";
import { runExecThreadSync, runExecThreadRefreshExisting, runExecThreadRefreshByExternalIds, runExecThreadImportSearchPage, ExecThreadSessionExpiredError } from "@/lib/execthread/sync";
import { recordExecThreadSyncResult } from "@/lib/execthread/session-store";

export const maxDuration = 300;

type SyncBody = {
  limit?: number;
  forceLogin?: boolean;
  /** When true, re-fetch full details for ET jobs already in Kimchi (not search import). */
  refreshExisting?: boolean;
  /** Re-fetch specific stored ExecThread jobs by externalId. */
  refreshExternalIds?: string[];
  /** Paginated catalog import — upserts search summaries (list-only by default). */
  importCatalogPage?: {
    from?: number;
    size?: number;
    listOnly?: boolean;
  };
};

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    /* empty body ok */
  }

  if (!execthreadConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "NOT_CONFIGURED",
        error: "ExecThread credentials are not set on this deployment.",
        hint: "Add EXECTHREAD_EMAIL and EXECTHREAD_PASSWORD in Vercel environment variables, then redeploy.",
      },
      { status: 503 },
    );
  }

  const limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : 5;

  try {
    const refreshExternalIds = Array.isArray(body.refreshExternalIds)
      ? body.refreshExternalIds.filter((id) => typeof id === "string" && id.trim())
      : [];

    const summary = refreshExternalIds.length
      ? await runExecThreadRefreshByExternalIds(refreshExternalIds, { forceLogin: body.forceLogin === true })
      : body.importCatalogPage
        ? await runExecThreadImportSearchPage({
            from: body.importCatalogPage.from,
            size: body.importCatalogPage.size,
            listOnly: body.importCatalogPage.listOnly,
            forceLogin: body.forceLogin === true,
          })
      : body.refreshExisting
        ? await runExecThreadRefreshExisting({ forceLogin: body.forceLogin === true })
        : await runExecThreadSync({
            limit,
            forceLogin: body.forceLogin === true,
          });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    if (err instanceof ExecThreadSessionExpiredError) {
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          error: err.message,
          hint: "Try again with forceLogin: true from the admin panel.",
        },
        { status: 401 },
      );
    }

    const message = err instanceof Error ? err.message : "Sync failed";
    await recordExecThreadSyncResult(false, message);
    console.error("[admin execthread sync]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
