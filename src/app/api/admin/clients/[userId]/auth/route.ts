import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchAdminClientById } from "@/lib/admin-client-provision";
import {
  clientHasAuthAccount,
  inviteClientAuthUser,
  sendClientPasswordResetEmail,
  setClientAuthPassword,
} from "@/lib/admin-client-auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const user = await prisma.user.findFirst({
    where: { id: userId, role: UserRole.USER },
    select: { email: true },
  });
  if (!user) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const hasAuthAccount = await clientHasAuthAccount(user.email);
  return NextResponse.json({ hasAuthAccount });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const user = await prisma.user.findFirst({
    where: { id: userId, role: UserRole.USER },
  });
  if (!user) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: "invite" | "password-reset" | "set-password";
    password?: string;
  };

  try {
    let message: string;

    switch (body.action) {
      case "invite": {
        const result = await inviteClientAuthUser(user.email, user.name);
        message = result.message;
        break;
      }
      case "password-reset": {
        const result = await sendClientPasswordResetEmail(user.email);
        message = result.message;
        break;
      }
      case "set-password": {
        if (!body.password?.trim()) {
          return NextResponse.json({ error: "Password is required." }, { status: 400 });
        }
        const result = await setClientAuthPassword({
          email: user.email,
          password: body.password,
          name: user.name,
        });
        message = result.message;
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const client = await fetchAdminClientById(userId);
    const hasAuthAccount = await clientHasAuthAccount(user.email);

    return NextResponse.json({ message, hasAuthAccount, client });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Auth action failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
