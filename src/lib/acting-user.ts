import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseFromRequest } from "@/lib/extension-api";
import { prisma } from "@/lib/prisma";

export const IMPERSONATE_COOKIE = "kimchi_impersonate";

export type ActingUserResult = {
  authUser: { id: string; email: string } | null;
  /** User whose data should be read/written */
  dbUser: User | null;
  /** Logged-in user (never swapped) */
  realDbUser: User | null;
  isImpersonating: boolean;
};

async function resolveImpersonateId(request?: Request): Promise<string | undefined> {
  if (request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${IMPERSONATE_COOKIE}=([^;]+)`));
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATE_COOKIE)?.value;
}

export async function getActingUser(request?: Request): Promise<ActingUserResult> {
  const supabase = request ? createSupabaseFromRequest(request) : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { authUser: null, dbUser: null, realDbUser: null, isImpersonating: false };
  }

  const realDbUser = await prisma.user.findUnique({ where: { email: user.email } });
  if (!realDbUser) {
    return {
      authUser: { id: user.id, email: user.email },
      dbUser: null,
      realDbUser: null,
      isImpersonating: false,
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
      };
    }
  }

  return {
    authUser: { id: user.id, email: user.email },
    dbUser: realDbUser,
    realDbUser,
    isImpersonating: false,
  };
}

/** User to use for quota / billing checks (admin stays admin while impersonating). */
export function quotaUserFor(result: ActingUserResult): User | null {
  return result.realDbUser ?? result.dbUser;
}

/** Admin-only client tooling (intake notes, admin nav) — hidden while impersonating. */
export function canAccessAdminClientTools(result: ActingUserResult): boolean {
  return result.realDbUser?.role === "ADMIN" && !result.isImpersonating;
}
