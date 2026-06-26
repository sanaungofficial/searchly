import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getReferralStats, completeReferral } from "@/lib/referrals";
import { markOnboardingComplete } from "@/lib/sync-auth-user";

async function getDbUser() {
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
  if (!user) return null;
  return prisma.user.findUnique({ where: { email: user.email! } });
}

export async function GET() {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stats = await getReferralStats(dbUser.id);
  return NextResponse.json(stats);
}

export async function POST(req: Request) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.action === "complete-onboarding") {
    await markOnboardingComplete(dbUser.id);
    const result = await completeReferral(dbUser.id);
    return NextResponse.json({ ...result, onboardingComplete: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
