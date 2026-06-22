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

export function isSuperAdmin(email: string | null | undefined): boolean {
  const configured = process.env.SUPER_ADMIN_EMAILS;
  const list = configured
    ? configured.split(",").map((e) => e.trim()).filter(Boolean)
    : ["sanhaung1@gmail.com", "sanaungmba@gmail.com"];
  return !!email && list.includes(email);
}
