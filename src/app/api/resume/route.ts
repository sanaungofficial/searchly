import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const STRUCTURED_PROMPT = `Extract the following from this resume and return ONLY valid JSON, no markdown, no explanation:

{
  "name": "full name or null",
  "phone": "phone number or null",
  "location": "city, state or null",
  "website": "personal website or null",
  "education": [
    {
      "id": "edu_0",
      "school": "school name",
      "degree": "degree type (e.g. Bachelor of Science)",
      "field": "field of study or null",
      "from": "YYYY-MM or null",
      "to": "YYYY-MM or null or 'Present'"
    }
  ],
  "workExperience": [
    {
      "id": "exp_0",
      "company": "company name",
      "title": "job title",
      "description": "one sentence description of the role or null",
      "from": "YYYY-MM or null",
      "to": "YYYY-MM or null or 'Present'",
      "bullets": ["achievement or responsibility bullet point"]
    }
  ],
  "skills": ["skill1", "skill2"]
}

Rules:
- IDs must be unique strings like edu_0, edu_1, exp_0, exp_1 etc.
- workExperience should be ordered newest first
- Include all jobs and education entries
- Extract every skill mentioned
- Return ONLY the JSON object, nothing else`;

const PARSE_MODEL = "claude-haiku-4-5-20251001";

async function extractFromPdf(base64: string): Promise<{ text: string; parsed: object | null; tokensIn: number; tokensOut: number }> {
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
            { type: "text", text: STRUCTURED_PROMPT },
          ],
        }],
      }),
    ]);

    const text = textMsg.content[0]?.type === "text" ? textMsg.content[0].text : "";
    let parsed: object | null = null;
    if (structuredMsg.content[0]?.type === "text") {
      try { parsed = JSON.parse(structuredMsg.content[0].text); } catch { parsed = null; }
    }
    const tokensIn = (textMsg.usage.input_tokens + structuredMsg.usage.input_tokens);
    const tokensOut = (textMsg.usage.output_tokens + structuredMsg.usage.output_tokens);
    return { text, parsed, tokensIn, tokensOut };
  } catch {
    return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
  }
}

async function extractFromText(rawText: string): Promise<{ text: string; parsed: object | null; tokensIn: number; tokensOut: number }> {
  try {
    const msg = await getAnthropic().messages.create({
      model: PARSE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: `${STRUCTURED_PROMPT}\n\nResume text:\n${rawText.slice(0, 8000)}` }],
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

async function extractResume(file: File): Promise<{ text: string; parsed: object | null; tokensIn: number; tokensOut: number }> {
  const bytes = await file.arrayBuffer();
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const base64 = Buffer.from(bytes).toString("base64");
    return extractFromPdf(base64);
  }

  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const { value: rawText } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      if (!rawText.trim()) return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
      return extractFromText(rawText);
    } catch {
      return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
    }
  }

  if (ext === "txt") {
    const rawText = Buffer.from(bytes).toString("utf-8");
    return extractFromText(rawText);
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

  const { text: resumeText, parsed: parsedData, tokensIn: rTokIn, tokensOut: rTokOut } = process.env.ANTHROPIC_API_KEY
    ? await extractResume(file)
    : { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (dbUser) {
    if (resumeText) logAiUsage(dbUser.id, "RESUME_PARSE", PARSE_MODEL, rTokIn, rTokOut);
    // Also update the user's name if extracted and not already set
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
      },
    });
  }

  return NextResponse.json({ url: publicUrl, parsed: !!parsedData });
}
