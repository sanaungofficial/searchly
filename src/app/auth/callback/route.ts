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

  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email) {
    try {
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
      const existing = await prisma.user.findUnique({ where: { email: user.email } });

      await prisma.user.upsert({
        where: { email: user.email },
        update: { name, avatarUrl: user.user_metadata?.avatar_url ?? null },
        create: { email: user.email, name, avatarUrl: user.user_metadata?.avatar_url ?? null },
      });

      if (!existing && process.env.RESEND_API_KEY) {
        try {
          await sendWelcomeEmail(user.email, name);
        } catch (emailErr) {
          console.error("[auth/callback] Welcome email failed:", emailErr);
        }
      }
    } catch (dbErr) {
      console.error("[auth/callback] DB upsert error:", dbErr);
      // Don't block sign-in if DB sync fails
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
