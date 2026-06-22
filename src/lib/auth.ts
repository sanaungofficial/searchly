import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export async function requireAdmin(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
  if (!dbUser || dbUser.role !== "ADMIN") return null;
  return dbUser;
}

export async function isAdmin(): Promise<boolean> {
  return (await requireAdmin()) !== null;
}
