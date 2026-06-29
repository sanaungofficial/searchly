import { getActingUser, canAccessAdminClientTools } from "@/lib/acting-user";
import { resolveAdminClientSubject, readClientUserIdFromRequest } from "@/lib/admin-client-subject";
import { serializeImportRunListItem } from "@/lib/client-import/import-run";
import { importRunUnavailableResponse, isPrismaMissingRelationError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteParams = { params: Promise<{ userId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
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

  try {
    const runs = await prisma.importRun.findMany({
      where: { clientUserId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { importedBy: { select: { name: true, email: true } } },
    });

    return NextResponse.json({
      runs: runs.map(serializeImportRunListItem),
    });
  } catch (err) {
    if (isPrismaMissingRelationError(err)) return importRunUnavailableResponse();
    console.error("[import history]", err);
    const message = err instanceof Error ? err.message : "Failed to load import history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
