import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchAdminClientById, provisionClient } from "@/lib/admin-client-provision";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const email = String(formData.get("email") ?? "").trim();
  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : null;
  const linkedinRaw = formData.get("linkedinUrl");
  const linkedinUrl = typeof linkedinRaw === "string" && linkedinRaw.trim() ? linkedinRaw.trim() : null;
  const resumeFile = formData.get("resume");
  const file = resumeFile instanceof File && resumeFile.size > 0 ? resumeFile : null;
  const sendInviteRaw = formData.get("sendInvite");
  const sendInvite =
    sendInviteRaw === "true" ||
    sendInviteRaw === "1" ||
    sendInviteRaw === "on";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const result = await provisionClient({
      email,
      name,
      resumeFile: file,
      linkedinUrl,
      sendInvite,
    });

    const client = await fetchAdminClientById(result.user.id);
    if (!client) {
      return NextResponse.json({ error: "Client created but could not be loaded." }, { status: 500 });
    }

    return NextResponse.json({
      client,
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

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clients = await prisma.user.findMany({
    where: { role: UserRole.USER },
    include: {
      profile: {
        select: {
          headline: true,
          targetRoles: true,
          targetSalary: true,
          resumeUrl: true,
          linkedinUrl: true,
        },
      },
      subscription: { select: { status: true, stripeCurrentPeriodEnd: true } },
      jobs: {
        select: { id: true, company: true, role: true, stage: true, appliedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { jobs: true, tailoredResumes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(clients);
}
