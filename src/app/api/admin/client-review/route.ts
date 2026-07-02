import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_REVIEW_COOKIE, IMPERSONATE_COOKIE } from "@/lib/acting-user";
import { isAdminRosterClientRole } from "@/lib/admin-client-roles";
import { canOrgAdminReviewEmployee, getAuthenticatedDbUser } from "@/lib/org-auth";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : null;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const platformAdmin = await requireAdmin();
  const dbUser = platformAdmin ?? (await getAuthenticatedDbUser());
  if (!dbUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || !isAdminRosterClientRole(target.role)) {
    return NextResponse.json({ error: "Only client accounts can be reviewed" }, { status: 400 });
  }

  if (!platformAdmin) {
    const allowed = await canOrgAdminReviewEmployee(dbUser.id, userId);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);
  cookieStore.set(ADMIN_REVIEW_COOKIE, target.id, COOKIE_OPTS);

  return NextResponse.json({
    ok: true,
    user: { id: target.id, email: target.email, name: target.name },
  });
}

export async function DELETE() {
  const platformAdmin = await requireAdmin();
  const dbUser = platformAdmin ?? (await getAuthenticatedDbUser());
  if (!dbUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_REVIEW_COOKIE);

  return NextResponse.json({ ok: true });
}
