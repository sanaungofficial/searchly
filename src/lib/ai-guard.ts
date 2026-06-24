import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isPro } from "@/lib/stripe";
import { consumeCredit } from "@/lib/usage";
import { CREDITS_EXHAUSTED_ERROR } from "@/lib/credits";

import { createSupabaseFromRequest } from "@/lib/extension-api";

export async function getAuthedUserForAiFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (cookieHeader.includes("sb-")) {
    const supabase = createSupabaseFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email! },
        include: { profile: true, subscription: true },
      });
      if (dbUser) return { dbUser, supabase };
    }
  }
  return getAuthedUserForAi();
}

export async function getAuthedUserForAi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse };
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true, subscription: true },
  });
  if (!dbUser) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) as NextResponse };
  }

  return { dbUser, supabase };
}

export function isProOrAdmin(dbUser: {
  role: string;
  subscription: { status: string } | null;
}): boolean {
  return isPro(dbUser.subscription) || dbUser.role === "ADMIN";
}

function creditsErrorBody(used: number, limit: number, remaining: number) {
  return {
    error: CREDITS_EXHAUSTED_ERROR,
    code: "CREDITS_EXHAUSTED",
    used,
    limit,
    remaining,
  };
}

/** Returns a 402 response if the free monthly credit balance is exhausted. */
export async function requireAiQuota(dbUser: {
  id: string;
  role: string;
  subscription: { status: string } | null;
}): Promise<NextResponse | null> {
  const { allowed, used, limit, remaining } = await consumeCredit(
    dbUser.id,
    isProOrAdmin(dbUser),
  );
  if (!allowed) {
    return NextResponse.json(creditsErrorBody(used, limit, remaining), { status: 402 });
  }
  return null;
}

export function aiLimitJsonResponse(used: number, limit: number, remaining = 0): Response {
  return new Response(JSON.stringify(creditsErrorBody(used, limit, remaining)), {
    status: 402,
    headers: { "Content-Type": "application/json" },
  });
}
