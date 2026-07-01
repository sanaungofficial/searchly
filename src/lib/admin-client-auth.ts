import { type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminRosterClientWhere } from "@/lib/admin-client-roles";
import { findSupabaseAuthUserIdByEmail, getSupabaseAdmin } from "@/lib/supabase-admin";
import { APP_HOME_PATH, resolveAppUrl, type RequestOriginSource } from "@/lib/site-host";

export function getAppAuthRedirectUrl(
  next = APP_HOME_PATH,
  req?: RequestOriginSource,
): string {
  const base = resolveAppUrl(req);
  const path = next.startsWith("/") ? next : `/${next}`;
  return `${base}/auth/callback?next=${encodeURIComponent(path)}`;
}

export async function clientHasAuthAccount(email: string): Promise<boolean> {
  return Boolean(await findSupabaseAuthUserIdByEmail(email));
}

export async function inviteClientAuthUser(
  email: string,
  name: string | null,
): Promise<{ invited: boolean; message: string }> {
  const normalized = email.trim().toLowerCase();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(normalized, {
    data: { full_name: name?.trim() ?? "" },
    redirectTo: getAppAuthRedirectUrl("/dashboard"),
  });

  if (data?.user?.id) {
    return { invited: true, message: `Invite email sent to ${normalized}.` };
  }

  if (error?.message.includes("already been registered")) {
    return {
      invited: false,
      message: "They already have a sign-in account — use password reset or set password instead.",
    };
  }

  if (error) throw new Error(error.message);
  throw new Error("Could not send invite.");
}

export async function sendClientPasswordResetEmail(email: string): Promise<{ message: string }> {
  const normalized = email.trim().toLowerCase();
  const hasAccount = await clientHasAuthAccount(normalized);
  if (!hasAccount) {
    throw new Error("No sign-in account yet. Send an invite or set a password first.");
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.resetPasswordForEmail(normalized, {
    redirectTo: getAppAuthRedirectUrl("/profile"),
  });
  if (error) throw new Error(error.message);

  return { message: `Password reset email sent to ${normalized}.` };
}

export async function setClientAuthPassword(input: {
  email: string;
  password: string;
  name?: string | null;
}): Promise<{ created: boolean; message: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const admin = getSupabaseAdmin();
  const existingId = await findSupabaseAuthUserIdByEmail(email);

  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, { password });
    if (error) throw new Error(error.message);
    return {
      created: false,
      message: "Password updated. They can sign in with this email and the new password.",
    };
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.name?.trim() ?? "" },
  });
  if (error) throw new Error(error.message);

  return {
    created: true,
    message: "Sign-in account created with that password. They can log in immediately.",
  };
}

export async function updateClientEmail(userId: string, newEmailRaw: string): Promise<User> {
  const newEmail = newEmailRaw.trim().toLowerCase();
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new Error("Enter a valid email address.");
  }

  const user = await prisma.user.findFirst({
    where: adminRosterClientWhere(userId),
  });
  if (!user) throw new Error("Client not found.");

  if (newEmail === user.email.toLowerCase()) return user;

  const taken = await prisma.user.findUnique({ where: { email: newEmail } });
  if (taken && taken.id !== userId) {
    throw new Error("That email is already used by another account.");
  }

  const authUserId = await findSupabaseAuthUserIdByEmail(user.email);
  if (authUserId) {
    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.updateUserById(authUserId, { email: newEmail });
    if (error) throw new Error(error.message);
  }

  return prisma.user.update({
    where: { id: userId },
    data: { email: newEmail },
  });
}
