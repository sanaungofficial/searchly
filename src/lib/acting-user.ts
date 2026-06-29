import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseFromRequest } from "@/lib/extension-api";
import { prisma } from "@/lib/prisma";

export const IMPERSONATE_COOKIE = "kimchi_impersonate";
/** Admin profile review (View profile) — not impersonation; httpOnly like impersonate. */
export const ADMIN_REVIEW_COOKIE = "kimchi_admin_review";

export type ActingUserResult = {
  authUser: { id: string; email: string } | null;
  /** User whose data should be read/written */
  dbUser: User | null;
  /** Logged-in user (never swapped) */
  realDbUser: User | null;
  isImpersonating: boolean;
  /** Admin viewing a client via ?clientUserId= (not impersonation). */
  isAdminReviewing: boolean;
};

function readClientUserIdFromRequest(request?: Request): string | null {
  if (!request) return null;
  const id = new URL(request.url).searchParams.get("clientUserId");
  return id?.trim() || null;
}

function readCookieFromHeader(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

async function resolveImpersonateId(request?: Request): Promise<string | undefined> {
  if (request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    return readCookieFromHeader(cookieHeader, IMPERSONATE_COOKIE);
  }
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATE_COOKIE)?.value;
}

async function resolveAdminReviewId(request?: Request): Promise<string | undefined> {
  if (request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    return readCookieFromHeader(cookieHeader, ADMIN_REVIEW_COOKIE);
  }
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_REVIEW_COOKIE)?.value;
}

export async function getActingUser(request?: Request): Promise<ActingUserResult> {
  const supabase = request ? createSupabaseFromRequest(request) : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { authUser: null, dbUser: null, realDbUser: null, isImpersonating: false, isAdminReviewing: false };
  }

  const realDbUser = await prisma.user.findUnique({ where: { email: user.email } });
  if (!realDbUser) {
    return {
      authUser: { id: user.id, email: user.email },
      dbUser: null,
      realDbUser: null,
      isImpersonating: false,
      isAdminReviewing: false,
    };
  }

  const impersonateId = await resolveImpersonateId(request);
  if (impersonateId && realDbUser.role === "ADMIN") {
    const target = await prisma.user.findUnique({ where: { id: impersonateId } });
    if (target && target.role === "USER") {
      return {
        authUser: { id: user.id, email: user.email },
        dbUser: target,
        realDbUser,
        isImpersonating: true,
        isAdminReviewing: false,
      };
    }
  }

  const clientUserId =
    readClientUserIdFromRequest(request) ?? (await resolveAdminReviewId(request)) ?? null;
  if (clientUserId && realDbUser.role === "ADMIN") {
    const client = await prisma.user.findUnique({ where: { id: clientUserId } });
    if (client && client.role === "USER") {
      return {
        authUser: { id: user.id, email: user.email },
        dbUser: client,
        realDbUser,
        isImpersonating: false,
        isAdminReviewing: true,
      };
    }
  }

  return {
    authUser: { id: user.id, email: user.email },
    dbUser: realDbUser,
    realDbUser,
    isImpersonating: false,
    isAdminReviewing: false,
  };
}

/** User to use for quota / billing checks (admin stays admin while impersonating). */
export function quotaUserFor(result: ActingUserResult): User | null {
  return result.realDbUser ?? result.dbUser;
}

/** Admin-only client tooling (intake notes, parse) — not available while impersonating. */
export function canAccessAdminClientTools(result: ActingUserResult): boolean {
  return result.realDbUser?.role === "ADMIN" && !result.isImpersonating;
}
