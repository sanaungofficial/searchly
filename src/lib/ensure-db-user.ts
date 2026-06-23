import type { User } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export async function ensureDbUser(supabase: SupabaseClient): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email.split("@")[0] ??
    null;
  const avatarUrl =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    null;

  return prisma.user.upsert({
    where: { email: user.email },
    update: { name: name ?? undefined, avatarUrl: avatarUrl ?? undefined },
    create: { email: user.email, name, avatarUrl },
  });
}
