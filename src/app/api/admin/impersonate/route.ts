import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getActingUser, IMPERSONATE_COOKIE } from "@/lib/acting-user";
import { UserRole } from "@prisma/client";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8, // 8 hours
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { dbUser, realDbUser, isImpersonating } = await getActingUser();
  if (!isImpersonating || !dbUser) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
    },
    admin: {
      id: realDbUser!.id,
      email: realDbUser!.email,
    },
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : null;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== UserRole.USER) {
    return NextResponse.json({ error: "Only client (USER) accounts can be impersonated" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, target.id, COOKIE_OPTS);

  return NextResponse.json({
    ok: true,
    user: {
      id: target.id,
      email: target.email,
      name: target.name,
    },
  });
}

export async function DELETE() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);

  return NextResponse.json({ ok: true });
}
