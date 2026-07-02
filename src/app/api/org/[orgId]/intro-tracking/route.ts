import { NextRequest, NextResponse } from "next/server";
import type { OrgIntroTrackingStatus } from "@prisma/client";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import {
  listOrgIntroTrackingForClient,
  patchOrgIntroTracking,
  upsertOrgIntroTracking,
} from "@/lib/org-intro-tracking";
import { isClientAssignedToOrg } from "@/lib/client-assignment";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES: OrgIntroTrackingStatus[] = ["REQUESTED", "SENT", "DONE", "DECLINED"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  const assigned = await isClientAssignedToOrg(orgId, clientId);
  if (!assigned) return NextResponse.json({ error: "Client not assigned to org" }, { status: 404 });

  const rows = await listOrgIntroTrackingForClient(orgId, clientId);
  return NextResponse.json({ tracking: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const clientId = String(body.clientId ?? "").trim();
  const orgContactId = String(body.orgContactId ?? "").trim();
  const status = String(body.status ?? "REQUESTED").trim() as OrgIntroTrackingStatus;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : undefined;

  if (!clientId || !orgContactId) {
    return NextResponse.json({ error: "clientId and orgContactId are required" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const assigned = await isClientAssignedToOrg(orgId, clientId);
  if (!assigned) return NextResponse.json({ error: "Client not assigned to org" }, { status: 404 });

  const contact = await prisma.orgContact.findFirst({
    where: { id: orgContactId, orgId },
    select: { id: true },
  });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const row = await upsertOrgIntroTracking({
    orgId,
    clientId,
    orgContactId,
    requestedByUserId: auth.user.id,
    status,
    notes,
  });

  return NextResponse.json({ tracking: row });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const statusRaw = body.status != null ? String(body.status).trim() : undefined;
  const status = statusRaw as OrgIntroTrackingStatus | undefined;
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const notes = body.notes !== undefined
    ? (typeof body.notes === "string" ? body.notes.trim() || null : null)
    : undefined;

  const row = await patchOrgIntroTracking({ orgId, id, status, notes });
  if (!row) return NextResponse.json({ error: "Tracking row not found" }, { status: 404 });

  return NextResponse.json({ tracking: row });
}
