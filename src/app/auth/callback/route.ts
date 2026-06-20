import { createClient } from "@/utils/supabase/server";
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

  return NextResponse.redirect(`${origin}${next}`);
}
