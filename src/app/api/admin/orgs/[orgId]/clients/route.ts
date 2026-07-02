import { isAdminRosterClientRole } from "@/lib/admin-client-roles";
import {
  assignClientToOrg,
  getClientsForOrg,
  removeClientFromOrg,
} from "@/lib/client-assignment";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function serializeClient(row: {
  assignmentId: string;
  userId: string;
  email: string;
  name: string | null;
  assignedAt: string;
  notes: string | null;
}) {
  return row;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const clients = await getClientsForOrg(orgId);
  return NextResponse.json({ clients: clients.map(serializeClient) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const clientId = String(body.clientId ?? "").trim();
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined;

  let targetUserId = clientId;
  if (!targetUserId && email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "No Kimchi user found for that email" }, { status: 404 });
    }
    targetUserId = user.id;
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "email or clientId is required" }, { status: 400 });
  }

  const client = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });
  if (!client || !isAdminRosterClientRole(client.role)) {
    return NextResponse.json({ error: "User is not a client account" }, { status: 400 });
  }

  const assignment = await assignClientToOrg({
    orgId,
    clientId: targetUserId,
    assignedByUserId: auth.user.id,
    notes,
  });

  return NextResponse.json({
    client: serializeClient({
      assignmentId: assignment.id,
      userId: assignment.client.id,
      email: assignment.client.email,
      name: assignment.client.name,
      assignedAt: assignment.createdAt.toISOString(),
      notes: assignment.notes,
    }),
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId ?? body.userId ?? "").trim();
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  await removeClientFromOrg(orgId, clientId);
  return NextResponse.json({ ok: true });
}
