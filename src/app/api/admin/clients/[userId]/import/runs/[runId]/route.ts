import { getActingUser, canAccessAdminClientTools } from "@/lib/acting-user";
import { resolveAdminClientSubject, readClientUserIdFromRequest } from "@/lib/admin-client-subject";
import { serializeImportRunDetail } from "@/lib/client-import/import-run";
import { importRunUnavailableResponse, isPrismaMissingRelationError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ userId: string; runId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const acting = await getActingUser(request);
  if (!acting.authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessAdminClientTools(acting)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId: pathUserId, runId } = await params;
  const clientUserId = readClientUserIdFromRequest(request) ?? pathUserId;
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return resolved.error;
  const dbUser = resolved.subject;
  if (!dbUser || dbUser.id !== pathUserId) {
    return NextResponse.json({ error: "Client mismatch" }, { status: 400 });
  }

  try {
    const run = await prisma.importRun.findFirst({
      where: { id: runId, clientUserId: dbUser.id },
      include: { importedBy: { select: { name: true, email: true } } },
    });

    if (!run) return NextResponse.json({ error: "Import run not found" }, { status: 404 });

    return NextResponse.json({ run: serializeImportRunDetail(run) });
  } catch (err) {
    if (isPrismaMissingRelationError(err)) return importRunUnavailableResponse();
    console.error("[import run detail]", err);
    const message = err instanceof Error ? err.message : "Failed to load import details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
