import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isPro } from "@/lib/stripe";
import { checkAndIncrementUsage } from "@/lib/usage";

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

/** Returns a 402 response if the free monthly AI quota is exhausted. */
export async function requireAiQuota(dbUser: {
  id: string;
  role: string;
  subscription: { status: string } | null;
}): Promise<NextResponse | null> {
  const { allowed, used, limit } = await checkAndIncrementUsage(
    dbUser.id,
    isProOrAdmin(dbUser),
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Monthly AI limit reached", used, limit },
      { status: 402 },
    );
  }
  return null;
}

export function aiLimitJsonResponse(used: number, limit: number): Response {
  return new Response(
    JSON.stringify({ error: "Monthly AI limit reached", used, limit }),
    { status: 402, headers: { "Content-Type": "application/json" } },
  );
}
