import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchAdminClientById } from "@/lib/admin-client-provision";
import { updateClientEmail } from "@/lib/admin-client-auth";
import { prisma } from "@/lib/prisma";
import { adminRosterClientWhere } from "@/lib/admin-client-roles";
import { upsertProfileFields } from "@/lib/profile-write";

type PatchBody = {
  email?: string;
  name?: string | null;
  headline?: string | null;
  linkedinUrl?: string | null;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  const existing = await prisma.user.findFirst({
    where: adminRosterClientWhere(userId),
  });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const hasUserField = "email" in body || "name" in body;
  const hasProfileField = "headline" in body || "linkedinUrl" in body;
  if (!hasUserField && !hasProfileField) {
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

    const profilePatch: { headline?: string | null; linkedinUrl?: string | null } = {};
    if ("headline" in body) profilePatch.headline = body.headline?.trim() || null;
    if ("linkedinUrl" in body) profilePatch.linkedinUrl = body.linkedinUrl?.trim() || null;
    if (Object.keys(profilePatch).length > 0) {
      await upsertProfileFields(userId, profilePatch);
    }

    const client = await fetchAdminClientById(userId);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    return NextResponse.json({ client });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update client.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
