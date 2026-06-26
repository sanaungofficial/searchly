import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isPro } from "@/lib/stripe";
import { getUsage } from "@/lib/usage";
import { hasActiveProTrial } from "@/lib/referrals";
import { FREE_MONTHLY_CREDITS, UNLIMITED_AI_FOR_ALL } from "@/lib/credits";

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

  const adminUser = dbUser.role === "ADMIN";
  const paidPro = isPro(dbUser.subscription);
  const trialPro = await hasActiveProTrial(dbUser.id);
  const proUser = adminUser || paidPro || trialPro;
  const unlimitedCredits = UNLIMITED_AI_FOR_ALL || adminUser || paidPro || trialPro;
  const credits = await getUsage(dbUser.id, { unlimited: unlimitedCredits });

  return NextResponse.json({
    isPro: proUser,
    isAdmin: adminUser,
    paidPro,
    trialPro,
    status: adminUser ? "admin" : (dbUser.subscription?.status ?? null),
    currentPeriodEnd: dbUser.subscription?.stripeCurrentPeriodEnd ?? null,
    credits,
    /** @deprecated use credits */
    usage: credits
      ? { used: credits.used, limit: credits.limit }
      : proUser
        ? { used: 0, limit: null }
        : { used: 0, limit: FREE_MONTHLY_CREDITS },
  });
}
