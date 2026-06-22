import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const email: string = (body.email ?? "").trim().toLowerCase();
  const name: string | null = body.name?.trim() || null;
  const role: UserRole = Object.values(UserRole).includes(body.role) ? body.role : UserRole.USER;

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const admin = getAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name ?? "" },
  });

  if (inviteError && !inviteError.message.includes("already been registered")) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  const dbUser = await prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role },
  });

  return NextResponse.json(dbUser);
}
