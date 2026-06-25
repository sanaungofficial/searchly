import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Resolve Supabase Auth user id for storage paths (may differ from Prisma User id). */
export async function findSupabaseAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const normalized = email.trim().toLowerCase();
  let page = 1;

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;

    const hit = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (hit?.id) return hit.id;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}
