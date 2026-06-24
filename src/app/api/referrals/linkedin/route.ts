import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { submitLinkedInShare } from "@/lib/referrals";
import { REFERRAL_SUPPORT_EMAIL } from "@/lib/plan-config";

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

export async function POST(req: Request) {
  const dbUser = await getDbUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postUrl } = await req.json();
  if (!postUrl?.trim()) {
    return NextResponse.json({ error: "Post URL is required" }, { status: 400 });
  }

  try {
    const submission = await submitLinkedInShare(dbUser.id, postUrl);
    return NextResponse.json({
      ok: true,
      submission,
      message: `Thanks! We'll review your post and activate Pro within 48 hours. You can also email ${REFERRAL_SUPPORT_EMAIL} with your link.`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Submission failed" },
      { status: 400 },
    );
  }
}
