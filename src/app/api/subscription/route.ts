import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPro } from "@/lib/stripe";
import { getUsage } from "@/lib/usage";
import { hasActiveProTrial } from "@/lib/referrals";
import { FREE_MONTHLY_CREDITS, UNLIMITED_AI_FOR_ALL } from "@/lib/credits";
import { getActingUser } from "@/lib/acting-user";

export async function GET() {
  const acting = await getActingUser();
  const { authUser, dbUser, isImpersonating } = acting;
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const userWithSub = await prisma.user.findUnique({
    where: { id: dbUser.id },
    include: { subscription: true },
  });
  if (!userWithSub) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const adminUser = !isImpersonating && userWithSub.role === "ADMIN";
  const paidPro = isPro(userWithSub.subscription);
  const trialPro = await hasActiveProTrial(userWithSub.id);
  const proUser = adminUser || paidPro || trialPro;
  const unlimitedCredits = UNLIMITED_AI_FOR_ALL || adminUser || paidPro || trialPro;
  const credits = await getUsage(userWithSub.id, { unlimited: unlimitedCredits });

  return NextResponse.json({
    isPro: proUser,
    isAdmin: adminUser,
    paidPro,
    trialPro,
    status: adminUser ? "admin" : (userWithSub.subscription?.status ?? null),
    currentPeriodEnd: userWithSub.subscription?.stripeCurrentPeriodEnd ?? null,
    credits,
    /** @deprecated use credits */
    usage: credits
      ? { used: credits.used, limit: credits.limit }
      : proUser
        ? { used: 0, limit: null }
        : { used: 0, limit: FREE_MONTHLY_CREDITS },
  });
}
