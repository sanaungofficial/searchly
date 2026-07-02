import { assignClientToOrg } from "@/lib/client-assignment";
import {
  fetchAdminClientById,
  parseProvisionClientFormData,
  provisionClient,
} from "@/lib/admin-client-provision";
import { requireOrgMemberOrPlatformAdmin } from "@/lib/org-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const auth = await requireOrgMemberOrPlatformAdmin(orgId, { adminOnly: true });
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const formData = await req.formData();
  const input = parseProvisionClientFormData(formData);
  if (!input.email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const notesRaw = formData.get("notes");
  const notes = typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : undefined;

  try {
    const result = await provisionClient(input);

    const assignment = await assignClientToOrg({
      orgId,
      clientId: result.user.id,
      assignedByUserId: auth.user.id,
      notes,
    });

    const client = await fetchAdminClientById(result.user.id);

    return NextResponse.json({
      client: client ?? {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        createdAt: result.user.createdAt.toISOString(),
      },
      assignment: {
        assignmentId: assignment.id,
        userId: assignment.client.id,
        email: assignment.client.email,
        name: assignment.client.name,
        assignedAt: assignment.createdAt.toISOString(),
        notes: assignment.notes,
      },
      invited: result.invited,
      resumeUploaded: result.resumeUploaded,
      linkedinImported: result.linkedinImported,
      warnings: result.warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create client.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
