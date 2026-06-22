import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
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

    const existing = await prisma.user.findUnique({ where: { email: user.email } });
    // If the user already has a custom-uploaded avatar, don't overwrite it with the OAuth one
    const preservedAvatar = existing?.avatarUrl ?? avatarUrl;
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name, avatarUrl: preservedAvatar },
      create: { email: user.email, name, avatarUrl },
    });
    // Send welcome email only on first sign-in
    if (!existing && process.env.RESEND_API_KEY) {
      sendWelcomeEmail(user.email, name).catch(() => {});
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
