import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { provisionUserFromAuth, resolveAuthRedirectForUser } from "@/lib/sync-auth-user";
import { createClient } from "@/utils/supabase/server";

/** Send signed-in users to dashboard/onboarding (or `next`) instead of marketing/auth pages. */
export async function redirectIfAuthenticated(next?: string | null): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return;

  const cookieStore = await cookies();
  const { dbUser } = await provisionUserFromAuth(user, cookieStore);
  redirect(await resolveAuthRedirectForUser(dbUser, next));
}
