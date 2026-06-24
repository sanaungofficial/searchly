import { prisma } from "@/lib/prisma";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  buildResumeFingerprint,
  isRoleAnalysisStale,
  normalizeRoleAnalysesMap,
  normalizeRoleGapAnalysis,
  type RoleAnalysesMap,
  type StoredRoleAnalysis,
} from "@/lib/role-gap";
import { getActingUser } from "@/lib/acting-user";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

async function saveRoleAnalysis(
  userId: string,
  role: string,
  analysis: StoredRoleAnalysis,
): Promise<void> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const existing = normalizeRoleAnalysesMap(profile?.roleAnalyses);
  const next: RoleAnalysesMap = { ...existing, [role]: analysis };
  await prisma.profile.upsert({
    where: { userId },
    update: { roleAnalyses: next as object },
    create: { userId, targetRoles: [], roleAnalyses: next as object },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role")?.trim();
  const force = searchParams.get("force") === "true";

  if (!role) return NextResponse.json({ error: "role required" }, { status: 400 });

  const { authUser, dbUser } = await getActingUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const resumeText = profile?.resumeText;
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  const declaredSkills: string[] =
    (profile?.parsedData as { skills?: string[] } | null)?.skills ?? [];
  const fingerprint = buildResumeFingerprint(profile?.resumeUrl, declaredSkills);
  const analyses = normalizeRoleAnalysesMap(profile?.roleAnalyses);
  const cached = analyses[role];

  if (!force && cached && !isRoleAnalysisStale(cached, fingerprint)) {
    return NextResponse.json({
      ...cached,
      cached: true,
      analyzedAt: cached.analyzedAt,
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
        stale: true,
        analyzedAt: cached.analyzedAt,
      });
    }
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const template = await getPrompt("ROLE_GAP");
  const prompt = interpolate(template, {
    role,
    resumeSlice: resumeText.slice(0, 6000),
    declaredSkills: declaredSkills.length > 0 ? declaredSkills.join(", ") : "none listed",
  });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = normalizeRoleGapAnalysis(JSON.parse(jsonMatch[0]));
    if (!parsed) throw new Error("Invalid analysis shape");

    const analyzedAt = new Date().toISOString();
    const stored: StoredRoleAnalysis = {
      ...parsed,
      analyzedAt,
      resumeFingerprint: fingerprint,
    };

    await saveRoleAnalysis(dbUser.id, role, stored);

    return NextResponse.json({
      ...stored,
      cached: false,
    });
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

export async function DELETE() {
  const { authUser, dbUser } = await getActingUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.profile.updateMany({
    where: { userId: dbUser.id },
    data: { roleAnalyses: {} },
  });

  return NextResponse.json({ ok: true });
}
