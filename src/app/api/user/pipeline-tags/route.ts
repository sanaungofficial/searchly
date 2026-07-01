import { NextRequest, NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  mergePipelineTagLibraryIntoParsedData,
  mergePipelineTagsIntoNotes,
  mergeTagLibraries,
  normalizePipelineTagDefinition,
  normalizePipelineTagLabel,
  normalizePipelineTags,
  parsePipelineTagLibraryFromParsedData,
  parsePipelineTagsFromNotes,
  summarizePipelineTags,
  upsertPipelineTagDefinition,
} from "@/lib/pipeline-tags";

async function loadTagContext(userId: string) {
  const [profile, jobs] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: { parsedData: true },
    }),
    prisma.job.findMany({
      where: { userId },
      select: { id: true, notes: true },
    }),
  ]);

  const libraryTags = parsePipelineTagLibraryFromParsedData(profile?.parsedData);
  const jobTags = jobs.map((job) => parsePipelineTagsFromNotes(job.notes));

  return { libraryTags, jobTags, jobs, parsedData: profile?.parsedData ?? null };
}

async function saveTagLibrary(userId: string, parsedData: unknown, libraryTags: ReturnType<typeof parsePipelineTagLibraryFromParsedData>) {
  const nextParsed = mergePipelineTagLibraryIntoParsedData(parsedData, libraryTags);
  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      parsedData: nextParsed as Prisma.InputJsonValue,
    },
    update: {
      parsedData: nextParsed as Prisma.InputJsonValue,
    },
  });
}

/** GET /api/user/pipeline-tags — list user's tag library with usage counts */
export async function GET(request: NextRequest) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { libraryTags, jobTags } = await loadTagContext(dbUser.id);
  const tags = summarizePipelineTags(libraryTags, jobTags);

  return NextResponse.json({ tags });
}

/** POST /api/user/pipeline-tags — create a library tag (optionally attach to a job) */
export async function POST(request: NextRequest) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    color?: string;
    variant?: string;
    jobId?: string;
  };

  const def = normalizePipelineTagDefinition({
    label: body.label ?? "",
    color: body.color,
    variant: body.variant,
  });
  if (!def) return NextResponse.json({ error: "Tag label is required" }, { status: 400 });

  const { libraryTags, jobTags, jobs, parsedData } = await loadTagContext(dbUser.id);
  const nextLibrary = upsertPipelineTagDefinition(libraryTags, def);
  await saveTagLibrary(dbUser.id, parsedData, nextLibrary);

  if (body.jobId?.trim()) {
    const job = jobs.find((row) => row.id === body.jobId!.trim());
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const current = parsePipelineTagsFromNotes(job.notes);
    const nextTags = normalizePipelineTags([...current, def.label]);

    await prisma.job.update({
      where: { id: job.id },
      data: { notes: mergePipelineTagsIntoNotes(job.notes, nextTags) },
    });
  }

  const refreshed = await loadTagContext(dbUser.id);
  return NextResponse.json(
    {
      tag: def,
      tags: summarizePipelineTags(refreshed.libraryTags, refreshed.jobTags),
      allTags: mergeTagLibraries(refreshed.libraryTags, refreshed.jobTags),
    },
    { status: 201 },
  );
}

/** PATCH /api/user/pipeline-tags — update color/variant for a library tag */
export async function PATCH(request: NextRequest) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    color?: string;
    variant?: string;
  };

  const label = normalizePipelineTagLabel(body.label ?? "");
  if (!label) return NextResponse.json({ error: "Tag label is required" }, { status: 400 });

  const { libraryTags, jobTags, parsedData } = await loadTagContext(dbUser.id);
  const existing = libraryTags.find((tag) => tag.label.toLowerCase() === label.toLowerCase());
  if (!existing) return NextResponse.json({ error: "Tag not in library" }, { status: 404 });

  const nextDef = normalizePipelineTagDefinition({
    label,
    color: body.color ?? existing.color,
    variant: body.variant ?? existing.variant,
  });
  if (!nextDef) return NextResponse.json({ error: "Invalid tag" }, { status: 400 });

  const nextLibrary = upsertPipelineTagDefinition(libraryTags, nextDef);
  await saveTagLibrary(dbUser.id, parsedData, nextLibrary);

  const refreshed = await loadTagContext(dbUser.id);
  return NextResponse.json({
    tag: nextDef,
    tags: summarizePipelineTags(refreshed.libraryTags, refreshed.jobTags),
  });
}

/** DELETE /api/user/pipeline-tags?label=... — remove from library and all jobs */
export async function DELETE(request: NextRequest) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const label = normalizePipelineTagLabel(
    new URL(request.url).searchParams.get("label") ?? "",
  );
  if (!label) return NextResponse.json({ error: "Tag label is required" }, { status: 400 });

  const key = label.toLowerCase();
  const { libraryTags, jobs, parsedData } = await loadTagContext(dbUser.id);

  await saveTagLibrary(
    dbUser.id,
    parsedData,
    libraryTags.filter((tag) => tag.label.toLowerCase() !== key),
  );

  await Promise.all(
    jobs
      .filter((job) => parsePipelineTagsFromNotes(job.notes).some((tag) => tag.toLowerCase() === key))
      .map((job) => {
        const nextTags = parsePipelineTagsFromNotes(job.notes).filter(
          (tag) => tag.toLowerCase() !== key,
        );
        return prisma.job.update({
          where: { id: job.id },
          data: { notes: mergePipelineTagsIntoNotes(job.notes, nextTags) },
        });
      }),
  );

  const refreshed = await loadTagContext(dbUser.id);
  return NextResponse.json({
    tags: summarizePipelineTags(refreshed.libraryTags, refreshed.jobTags),
    allTags: mergeTagLibraries(refreshed.libraryTags, refreshed.jobTags),
  });
}
