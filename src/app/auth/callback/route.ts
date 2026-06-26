import { createClient } from "@/utils/supabase/server";
import { authRedirectForUser, provisionUserFromAuth } from "@/lib/sync-auth-user";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function loginRedirect(origin: string, message: string) {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}

function isPkceVerifierError(message: string) {
  return message.toLowerCase().includes("code verifier");
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return loginRedirect(origin, oauthError);
  }

  const supabase = await createClient();
  let authError: { message: string } | null = null;

  // Email links should use token_hash (works cross-browser). Prefer over PKCE code.
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    authError = error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error && isPkceVerifierError(error.message)) {
      return loginRedirect(
        origin,
        "This confirmation link must be opened in the same browser where you signed up. Your email may already be confirmed — try signing in with your password."
      );
    }
    authError = error;
  } else {
    // Implicit/hash tokens are client-only — preserve query string for /auth/confirm.
    const qs = searchParams.toString();
    return NextResponse.redirect(`${origin}/auth/confirm${qs ? `?${qs}` : ""}`);
  }

  if (authError) {
    return loginRedirect(origin, authError.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return loginRedirect(origin, "Not authenticated");
  }

  try {
    const cookieStore = await cookies();
    const { isNewUser } = await provisionUserFromAuth(user, cookieStore);
    const redirectTo = authRedirectForUser(isNewUser, next);
    return NextResponse.redirect(`${origin}${redirectTo}`);
  } catch (err) {
    console.error("[auth/callback]", err);
    return NextResponse.redirect(`${origin}/login?error=account_sync_failed`);
  }
}
