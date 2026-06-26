import { createClient } from "@/utils/supabase/server";
import { resolveAuthRedirectForUser, provisionUserFromAuth } from "@/lib/sync-auth-user";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const cookieStore = await cookies();
    const { isNewUser, dbUser } = await provisionUserFromAuth(user, cookieStore);
    const body = await request.json().catch(() => ({}));
    const next = typeof body.next === "string" ? body.next : null;

    const redirectTo = await resolveAuthRedirectForUser(dbUser, next);

    return NextResponse.json({
      redirectTo,
      isNewUser,
      onboardingComplete: redirectTo === "/dashboard",
    });
  } catch (err) {
    console.error("[auth/sync-user]", err);
    return NextResponse.json({ error: "Could not sync account" }, { status: 500 });
  }
}
