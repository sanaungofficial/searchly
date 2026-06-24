import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";

// PATCH /api/jobs/[id] — update stage, notes, etc.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.job.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = await prisma.job.update({
    where: { id },
    data: {
      ...(body.stage && { stage: body.stage }),
      ...(body.url !== undefined && { url: body.url }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.userNotes !== undefined && { userNotes: body.userNotes }),
      ...(body.companyLinkedinUrl !== undefined && { companyLinkedinUrl: body.companyLinkedinUrl }),
      ...(body.coverLetter !== undefined && { coverLetter: body.coverLetter }),
      ...(body.fitAnalysis !== undefined && { fitAnalysis: body.fitAnalysis }),
      ...(body.resumeUrl !== undefined && { resumeUrl: body.resumeUrl }),
      ...(body.stage === "APPLIED" && { appliedAt: new Date() }),
    },
  });

  return NextResponse.json(job);
}

// DELETE /api/jobs/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.job.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.job.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
