import type { User } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActingUser } from "@/lib/acting-user";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { persistExternalImageToAvatarsBucket } from "@/lib/persist-external-image";
import { prisma } from "@/lib/prisma";

export async function ensureDbUser(supabase: SupabaseClient, request?: Request): Promise<User | null> {
  if (request) {
    const scoped = await resolveScopedDbUser(request);
    if (scoped.dbUser) return scoped.dbUser;
  }

  const acting = await getActingUser(request);
  if (acting.dbUser) return acting.dbUser;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const existing = await prisma.user.findUnique({ where: { email: user.email } });
  if (existing) return existing;

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email.split("@")[0] ??
    null;
  const oauthAvatarUrl =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    null;

  let avatarUrl: string | null = null;
  if (oauthAvatarUrl) {
    const persisted = await persistExternalImageToAvatarsBucket({
      sourceUrl: oauthAvatarUrl,
      storagePath: `${user.id}/avatar.jpg`,
    });
    avatarUrl = persisted.url ?? oauthAvatarUrl;
  }

  try {
    return await prisma.user.create({
      data: { email: user.email, name, avatarUrl },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      const raced = await prisma.user.findUnique({ where: { email: user.email } });
      if (raced) return raced;
    }
    console.error("[ensureDbUser]", err);
    return null;
  }
}
