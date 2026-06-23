import { getAuthedUserForAiFromRequest, requireAiQuota } from "@/lib/ai-guard";
import {
  extensionPreflightResponse,
  withExtensionCors,
} from "@/lib/extension-api";
import { getPrompt, interpolate } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

let _a: Anthropic | null = null;
function getAnthropic() {
  if (!_a) _a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _a;
}

function jsonWithCors(request: Request, body: unknown, status = 200) {
  return withExtensionCors(request, NextResponse.json(body, { status }));
}

export async function OPTIONS(request: Request) {
  const preflight = extensionPreflightResponse(request);
  if (preflight) return preflight;
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const preflight = extensionPreflightResponse(req);
  if (preflight) return preflight;

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonWithCors(req, { error: "AI not configured" }, 503);
  }

  const auth = await getAuthedUserForAiFromRequest(req);
  if ("error" in auth) return withExtensionCors(req, auth.error);
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser);
  if (quotaError) return withExtensionCors(req, quotaError);

  const resumeText = dbUser.profile?.resumeText;
  if (!resumeText) {
    return jsonWithCors(req, { error: "No resume found" }, 404);
  }

  const body = await req.json();
  const { jobTitle, company, description } = body as {
    jobTitle?: string;
    company?: string;
    description?: string;
  };

  if (!description) {
    return jsonWithCors(req, { error: "No job description provided" }, 400);
  }

  const template = await getPrompt("JOB_MATCH");
  const prompt = interpolate(template, {
    jobTitle: jobTitle || "Unknown",
    company: company || "Unknown",
    description: description.slice(0, 4000),
    resumeSlice: resumeText.slice(0, 4000),
  });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return jsonWithCors(req, { error: "Unexpected response" }, 500);
  }

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);
    return jsonWithCors(req, result);
  } catch {
    return jsonWithCors(req, { error: "Failed to parse response" }, 500);
  }
}
