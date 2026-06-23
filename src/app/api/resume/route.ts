import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const PARSE_MODEL = "claude-haiku-4-5-20251001";

async function extractFromPdf(base64: string, structuredPrompt: string): Promise<{ text: string; parsed: object | null; tokensIn: number; tokensOut: number }> {
  try {
    const [textMsg, structuredMsg] = await Promise.all([
      getAnthropic().messages.create({
        model: PARSE_MODEL,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: "Extract all text from this resume exactly as written. Output only the extracted text, nothing else." },
          ],
        }],
      }),
      getAnthropic().messages.create({
        model: PARSE_MODEL,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: structuredPrompt },
          ],
        }],
      }),
    ]);

    const text = textMsg.content[0]?.type === "text" ? textMsg.content[0].text : "";
    let parsed: object | null = null;
    if (structuredMsg.content[0]?.type === "text") {
      try { parsed = JSON.parse(structuredMsg.content[0].text); } catch { parsed = null; }
    }
    const tokensIn = textMsg.usage.input_tokens + structuredMsg.usage.input_tokens;
    const tokensOut = textMsg.usage.output_tokens + structuredMsg.usage.output_tokens;
    return { text, parsed, tokensIn, tokensOut };
  } catch {
    return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
  }
}

async function extractFromText(rawText: string, structuredPrompt: string): Promise<{ text: string; parsed: object | null; tokensIn: number; tokensOut: number }> {
  try {
    const msg = await getAnthropic().messages.create({
      model: PARSE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: `${structuredPrompt}\n\nResume text:\n${rawText.slice(0, 8000)}` }],
    });
    let parsed: object | null = null;
    if (msg.content[0]?.type === "text") {
      try { parsed = JSON.parse(msg.content[0].text); } catch { parsed = null; }
    }
    return { text: rawText, parsed, tokensIn: msg.usage.input_tokens, tokensOut: msg.usage.output_tokens };
  } catch {
    return { text: rawText, parsed: null, tokensIn: 0, tokensOut: 0 };
  }
}

async function extractResume(file: File, structuredPrompt: string): Promise<{ text: string; parsed: object | null; tokensIn: number; tokensOut: number }> {
  const bytes = await file.arrayBuffer();
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const base64 = Buffer.from(bytes).toString("base64");
    return extractFromPdf(base64, structuredPrompt);
  }

  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const { value: rawText } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      if (!rawText.trim()) return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
      return extractFromText(rawText, structuredPrompt);
    } catch {
      return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
    }
  }

  if (ext === "txt") {
    const rawText = Buffer.from(bytes).toString("utf-8");
    return extractFromText(rawText, structuredPrompt);
  }

  return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop();
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

  const structuredPrompt = process.env.ANTHROPIC_API_KEY ? await getPrompt("RESUME_PARSE") : "";

  const { text: resumeText, parsed: parsedData, tokensIn: rTokIn, tokensOut: rTokOut } = process.env.ANTHROPIC_API_KEY
    ? await extractResume(file, structuredPrompt)
    : { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email!.split("@")[0];

  const dbUser = await prisma.user.upsert({
    where: { email: user.email! },
    update: {},
    create: { email: user.email!, name },
  });

  if (resumeText) logAiUsage(dbUser.id, "RESUME_PARSE", PARSE_MODEL, rTokIn, rTokOut);

  const extractedName = (parsedData as Record<string, unknown> | null)?.name as string | undefined;
  if (extractedName && !dbUser.name) {
    await prisma.user.update({ where: { id: dbUser.id }, data: { name: extractedName } });
  }

  await prisma.profile.upsert({
    where: { userId: dbUser.id },
    update: {
      resumeUrl: publicUrl,
      ...(resumeText ? { resumeText } : {}),
      ...(parsedData ? { parsedData } : {}),
    },
    create: {
      userId: dbUser.id,
      resumeUrl: publicUrl,
      resumeText: resumeText || undefined,
      parsedData: parsedData ?? undefined,
      targetRoles: [],
      priorities: [],
    },
  });

  await prisma.userAsset.updateMany({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
    data: { isPrimary: false },
  });

  const asset = await prisma.userAsset.create({
    data: {
      userId: dbUser.id,
      type: "RESUME",
      name: file.name.replace(/\.[^/.]+$/, "") || "Resume",
      url: publicUrl,
      isPrimary: true,
    },
  });

  return NextResponse.json({ url: publicUrl, parsed: !!parsedData, asset });
}
