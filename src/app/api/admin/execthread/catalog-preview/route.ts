import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { execthreadConfigured } from "@/lib/execthread/client";
import { previewExecThreadCatalogTotal } from "@/lib/execthread/sync";
import { ExecThreadSessionExpiredError } from "@/lib/execthread/sync";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!execthreadConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "NOT_CONFIGURED",
        error: "ExecThread credentials are not set on this deployment.",
      },
      { status: 503 },
    );
  }

  try {
    const preview = await previewExecThreadCatalogTotal();
    return NextResponse.json({ ok: true, ...preview });
  } catch (err) {
    if (err instanceof ExecThreadSessionExpiredError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message, hint: "Try force re-login from admin." },
        { status: 401 },
      );
    }
    const message = err instanceof Error ? err.message : "Preview failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
