import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchAdminClientById } from "@/lib/admin-client-provision";
import { updateClientEmail } from "@/lib/admin-client-auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string | null };

  const existing = await prisma.user.findFirst({
    where: { id: userId, role: UserRole.USER },
  });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (!("email" in body) && !("name" in body)) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    if (typeof body.email === "string" && body.email.trim()) {
      await updateClientEmail(userId, body.email);
    }

    if ("name" in body) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: body.name?.trim() || null },
      });
    }

    const client = await fetchAdminClientById(userId);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    return NextResponse.json({ client });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update client.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
