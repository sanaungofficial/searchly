import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { normalizeQaTags, serializeApplicationQaEntry } from "@/lib/application-qa";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const tag = searchParams.get("tag")?.trim() ?? "";

  const where: Prisma.ApplicationQaEntryWhereInput = { userId: dbUser.id };
  if (tag) where.tags = { has: tag };
  if (q) {
    where.OR = [
      { question: { contains: q, mode: "insensitive" } },
      { answer: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.applicationQaEntry.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    entries: rows.map(serializeApplicationQaEntry),
  });
}

export async function POST(request: NextRequest) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    question?: string;
    answer?: string;
    tags?: unknown;
  };

  const question = body.question?.trim() ?? "";
  const answer = body.answer?.trim() ?? "";
  if (!question) return NextResponse.json({ error: "Question is required" }, { status: 400 });
  if (!answer) return NextResponse.json({ error: "Answer is required" }, { status: 400 });

  const row = await prisma.applicationQaEntry.create({
    data: {
      userId: dbUser.id,
      question: question.slice(0, 2000),
      answer: answer.slice(0, 8000),
      tags: normalizeQaTags(body.tags),
    },
  });

  return NextResponse.json({ entry: serializeApplicationQaEntry(row) }, { status: 201 });
}
