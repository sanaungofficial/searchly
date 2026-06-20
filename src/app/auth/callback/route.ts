import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    console.error("[auth/callback] No code in request");
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession error:", exchangeError.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // Upsert the user row so all API routes that look up by email work immediately.
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    const name =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email.split("@")[0];
    const avatarUrl =
      user.user_metadata?.avatar_url ??
      user.user_metadata?.picture ??
      null;

    await prisma.user.upsert({
      where: { email: user.email },
      update: { name, avatarUrl },
      create: { email: user.email, name, avatarUrl },
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
