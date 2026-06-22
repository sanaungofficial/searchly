import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getPrompt, interpolate } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _a: Anthropic | null = null;
function getAnthropic() {
  if (!_a) _a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _a;
}

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });

  const profile = dbUser?.profile;
  const resumeText = profile?.resumeText;
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  const parsedData = profile?.parsedData as Record<string, unknown> | null;
  const skills = Array.isArray(parsedData?.skills)
    ? (parsedData.skills as string[]).join(", ")
    : "";
  const linkedinUrl = profile?.linkedinUrl || "";
  const headline = profile?.headline || "";
  const targetRoles = Array.isArray(profile?.targetRoles)
    ? (profile.targetRoles as string[]).join(", ")
    : "";

  const template = await getPrompt("PROFILE_SUGGESTIONS");
  const prompt = interpolate(template, {
    resumeSlice: resumeText.slice(0, 5000),
    linkedinUrl: linkedinUrl || "Not provided",
    headline: headline || "Not provided",
    skills: skills || "None listed",
    targetRoles: targetRoles || "Not specified",
  });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");
    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}
