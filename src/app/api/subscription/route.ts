import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isPro } from "@/lib/stripe";
import { getUsage, FREE_AI_LIMIT } from "@/lib/usage";

export async function GET() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { subscription: true },
  });

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const proUser = isPro(dbUser.subscription);
  const usage = proUser ? { used: 0, limit: Infinity } : await getUsage(dbUser.id);

  return NextResponse.json({
    isPro: proUser,
    status: dbUser.subscription?.status ?? null,
    currentPeriodEnd: dbUser.subscription?.stripeCurrentPeriodEnd ?? null,
    usage: {
      used: usage.used,
      limit: proUser ? null : FREE_AI_LIMIT,
    },
  });
}
