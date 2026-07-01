import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import {
  mergePipelineTagsIntoNotes,
  normalizePipelineTags,
  parsePipelineTagsFromNotes,
} from "@/lib/pipeline-tags";
import { parseJobMetaFromNotes } from "@/lib/client-import/enrich-jobs";

// PATCH /api/jobs/[id] — update stage, notes, etc.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.job.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let notesUpdate: string | undefined;
  if (body.pipelineTags !== undefined) {
    notesUpdate = mergePipelineTagsIntoNotes(
      existing.notes,
      normalizePipelineTags(body.pipelineTags),
    );
  } else if (body.notes !== undefined) {
    notesUpdate = body.notes;
  }

  const job = await prisma.job.update({
    where: { id },
    data: {
      ...(body.stage && { stage: body.stage }),
      ...(body.url !== undefined && { url: body.url }),
      ...(notesUpdate !== undefined && { notes: notesUpdate }),
      ...(body.userNotes !== undefined && { userNotes: body.userNotes }),
      ...(body.companyLinkedinUrl !== undefined && { companyLinkedinUrl: body.companyLinkedinUrl }),
      ...(body.coverLetter !== undefined && { coverLetter: body.coverLetter }),
      ...(body.fitAnalysis !== undefined && { fitAnalysis: body.fitAnalysis }),
      ...(body.resumeUrl !== undefined && { resumeUrl: body.resumeUrl }),
      ...(body.stage === "APPLIED" && { appliedAt: new Date() }),
    },
  });

  const meta = parseJobMetaFromNotes(job.notes);
  return NextResponse.json({
    ...job,
    pipelineTags: parsePipelineTagsFromNotes(job.notes),
    _meta: meta,
  });
}

// DELETE /api/jobs/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.job.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.job.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
