import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;

        const existing = await prisma.user.findUnique({ where: { email: user.email! } });

        await prisma.user.upsert({
          where: { email: user.email! },
          update: { name, avatarUrl: user.user_metadata?.avatar_url ?? null },
          create: { email: user.email!, name, avatarUrl: user.user_metadata?.avatar_url ?? null },
        });

        // Send welcome email only on first sign-in and when Resend is configured
        if (!existing && process.env.RESEND_API_KEY) {
          try {
            await sendWelcomeEmail(user.email!, name);
          } catch {
            // Don't block sign-in if email fails
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
