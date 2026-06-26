import type { User } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessAdminClientTools, type ActingUserResult } from "@/lib/acting-user";

export function readClientUserIdFromRequest(request?: Request): string | null {
  if (!request) return null;
  const id = new URL(request.url).searchParams.get("clientUserId");
  return id?.trim() || null;
}

/** Resolve whose profile data an admin/coach API call should target. */
export async function resolveAdminClientSubject(
  acting: ActingUserResult,
  clientUserId: string | null | undefined,
): Promise<{ subject: User | null; error?: NextResponse }> {
  if (!clientUserId) {
    return { subject: acting.dbUser };
  }

  if (acting.isImpersonating) {
    return {
      subject: null,
      error: NextResponse.json(
        { error: "Use impersonation or admin profile review — not both" },
        { status: 400 },
      ),
    };
  }

  if (!canAccessAdminClientTools(acting)) {
    return { subject: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const client = await prisma.user.findUnique({ where: { id: clientUserId } });
  if (!client || client.role !== "USER") {
    return { subject: null, error: NextResponse.json({ error: "Client not found" }, { status: 404 }) };
  }

  return { subject: client };
}

export function withClientUserId(path: string, clientUserId?: string | null): string {
  if (!clientUserId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}clientUserId=${encodeURIComponent(clientUserId)}`;
}
