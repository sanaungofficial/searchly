import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

async function extractResumeText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const { value: rawText } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      if (!rawText.trim()) return "";
      const msg = await getAnthropic().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: `Summarize this resume in 400 words or less. Include: full name, most recent job title, years of experience, top skills, work history (company + title + key accomplishments), education. Plain text only.\n\n${rawText.slice(0, 8000)}` }],
      });
      const block = msg.content[0];
      return block.type === "text" ? block.text : "";
    } catch {
      return "";
    }
  }

  if (ext === "txt") {
    return Buffer.from(bytes).toString("utf-8").slice(0, 4000);
  }

  if (ext !== "pdf") return "";

  try {
    const msg = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: "Extract all text from this resume exactly as written. Preserve the structure (sections, bullet points). Output only the extracted text, nothing else.",
            },
          ],
        },
      ],
    });
    const block = msg.content[0];
    return block.type === "text" ? block.text : "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.split(".").pop();
  const path = `${user.id}/resume-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1-year signed URL

  if (signedError || !signedData) {
    return NextResponse.json({ error: "Could not generate file URL" }, { status: 500 });
  }

  const publicUrl = signedData.signedUrl;

  // Extract resume text (best-effort — don't fail the upload if this fails)
  const resumeText = process.env.ANTHROPIC_API_KEY ? await extractResumeText(file) : "";

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (dbUser) {
    await prisma.profile.upsert({
      where: { userId: dbUser.id },
      update: { resumeUrl: publicUrl, resumeText: resumeText || undefined },
      create: { userId: dbUser.id, resumeUrl: publicUrl, resumeText: resumeText || undefined },
    });
  }

  return NextResponse.json({ url: publicUrl });
}
