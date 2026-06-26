import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { extractRawResumeText } from "@/lib/resume-extract";
import { runResumeAssetParse, isResumeParseRunning } from "@/lib/resume-asset-parse";
import { getActingUser } from "@/lib/acting-user";
import { readClientUserIdFromRequest, resolveAdminClientSubject } from "@/lib/admin-client-subject";
import { NextResponse, after } from "next/server";

export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const acting = await getActingUser(request);

  if (!acting.authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientUserId = readClientUserIdFromRequest(request);
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return resolved.error;
  const actingUser = resolved.subject;
  if (!actingUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["pdf", "docx", "txt"].includes(ext)) {
    return NextResponse.json({ error: "Upload a PDF, DOCX, or TXT resume" }, { status: 400 });
  }

  const runningAsset = await prisma.userAsset.findFirst({
    where: { userId: actingUser.id, type: "RESUME", parseStatus: "running" },
    orderBy: { createdAt: "desc" },
  });
  if (
    runningAsset &&
    isResumeParseRunning(
      runningAsset.parseStatus as "running" | "complete" | "failed" | null,
      runningAsset.parseStartedAt,
    )
  ) {
    return NextResponse.json(
      {
        status: "running",
        asset: runningAsset,
        defaultName: runningAsset.name,
        message: "A resume is already being analyzed.",
      },
      { status: 202 },
    );
  }

  const path = `${user.id}/resume-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, file, { upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: signedData, error: signedError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  if (signedError || !signedData) {
    return NextResponse.json({ error: "Could not generate file URL" }, { status: 500 });
  }

  const publicUrl = signedData.signedUrl;
  const bytes = Buffer.from(await file.arrayBuffer());
  const rawText = await extractRawResumeText(bytes, ext);

  if (!rawText.trim()) {
    return NextResponse.json({ error: "Could not read text from this file. Try PDF, DOCX, or TXT." }, { status: 422 });
  }

  const dbUser = actingUser;
  const defaultName = file.name.replace(/\.[^/.]+$/, "") || "Resume";
  const startedAt = new Date();

  await prisma.userAsset.updateMany({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
    data: { isPrimary: false },
  });

  const asset = await prisma.userAsset.create({
    data: {
      userId: dbUser.id,
      type: "RESUME",
      name: defaultName,
      url: publicUrl,
      isPrimary: true,
      resumeText: rawText,
      parseStatus: "running",
      parseStartedAt: startedAt,
    },
  });

  const assetId = asset.id;
  const userId = dbUser.id;

  after(async () => {
    await runResumeAssetParse(assetId, userId).catch((err) => {
      console.error("[resume POST after]", err);
    });
  });

  return NextResponse.json(
    {
      status: "running",
      asset,
      defaultName,
      url: publicUrl,
    },
    { status: 202 },
  );
}
