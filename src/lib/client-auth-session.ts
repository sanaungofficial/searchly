import { createClient } from "@/utils/supabase/client";

/** True when Supabase session is accepted by the app API (not just localStorage). */
export async function hasValidClientSession(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  try {
    const res = await fetch("/api/profile", { cache: "no-store" });
    if (res.ok) return true;
  } catch {
    // fall through to sign-out
  }

  await supabase.auth.signOut();
  return false;
}
