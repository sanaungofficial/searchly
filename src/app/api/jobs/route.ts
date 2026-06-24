import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  createSupabaseFromRequest,
  extensionPreflightResponse,
  withExtensionCors,
} from "@/lib/extension-api";
import { getActingUser } from "@/lib/acting-user";

// GET /api/jobs — list all jobs for current user
export async function GET(request: Request) {
  const preflight = extensionPreflightResponse(request);
  if (preflight) return preflight;

  const { dbUser } = await getActingUser(request);
  if (!dbUser) {
    return withExtensionCors(
      request,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  const jobs = await prisma.job.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });

  return withExtensionCors(request, NextResponse.json(jobs));
}

// POST /api/jobs — create a new job
export async function POST(request: Request) {
  const preflight = extensionPreflightResponse(request);
  if (preflight) return preflight;

  const { dbUser } = await getActingUser(request);
  if (!dbUser) {
    return withExtensionCors(
      request,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
  }

  const body = await request.json();
  const { company, role, url, stage, notes } = body;

  if (!company || !role) {
    return withExtensionCors(
      request,
      NextResponse.json({ error: "company and role are required" }, { status: 400 })
    );
  }

  const job = await prisma.job.create({
    data: {
      userId: dbUser.id,
      company,
      role,
      url: url ?? null,
      stage: stage ?? "SAVED",
      notes: notes ?? null,
    },
  });

  return withExtensionCors(request, NextResponse.json(job, { status: 201 }));
}
