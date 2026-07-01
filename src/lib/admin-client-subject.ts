import type { User } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessAdminClientTools, getActingUser, type ActingUserResult } from "@/lib/acting-user";
import { isAdminRosterClientRole } from "@/lib/admin-client-roles";

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
  // Impersonation cookie always wins — ignore stale ?clientUserId= left from admin review.
  if (acting.isImpersonating) {
    return { subject: acting.dbUser };
  }

  if (!clientUserId) {
    return { subject: acting.dbUser };
  }

  if (!canAccessAdminClientTools(acting)) {
    return { subject: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const client = await prisma.user.findUnique({ where: { id: clientUserId } });
  if (!client || !isAdminRosterClientRole(client.role)) {
    return { subject: null, error: NextResponse.json({ error: "Client not found" }, { status: 404 }) };
  }

  return { subject: client };
}

/** Shared resolver for profile-scoped API routes (self, impersonation, or admin client review). */
export async function resolveProfileApiSubject(request: Request): Promise<
  | { error: NextResponse }
  | {
      acting: ActingUserResult;
      authUser: { id: string; email: string };
      dbUser: User;
      clientUserId: string | null;
    }
> {
  const acting = await getActingUser(request);
  if (!acting.authUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const clientUserId = readClientUserIdFromRequest(request);
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return { error: resolved.error };

  const dbUser = resolved.subject;
  if (!dbUser) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  return { acting, authUser: acting.authUser, dbUser, clientUserId };
}

/** Resolve dbUser for any workspace API (self, impersonation, or admin client review). */
export async function resolveScopedDbUser(
  request: Request,
): Promise<{ dbUser: User | null; error?: NextResponse }> {
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return { dbUser: null, error: resolved.error };
  return { dbUser: resolved.dbUser };
}

