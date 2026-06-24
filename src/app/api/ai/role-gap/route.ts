import { prisma } from "@/lib/prisma";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  buildResumeFingerprint,
  getStoredRoleAnalysis,
  normalizeRoleAnalysesMap,
  normalizeRoleGapAnalysis,
  setStoredRoleAnalysis,
  type StoredRoleAnalysis,
} from "@/lib/role-gap";
import { getActingUser } from "@/lib/acting-user";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
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
  const next = setStoredRoleAnalysis(existing, role, analysis);
  await prisma.profile.upsert({
    where: { userId },
    update: { roleAnalyses: next as object },
    create: { userId, targetRoles: [], roleAnalyses: next as object },
  });
}

async function resolveResumeSource(
  userId: string,
  assetId: string | null,
  profile: {
    resumeUrl: string | null;
    resumeText: string | null;
    parsedData: unknown;
  } | null,
) {
  if (assetId) {
    const asset = await prisma.userAsset.findFirst({
      where: { id: assetId, userId, type: "RESUME" },
    });
    if (!asset?.resumeText) {
      return null;
    }
    const parsed = normalizeParsedResumeData(asset.parsedData ?? null);
    return {
      resumeText: asset.resumeText,
      resumeUrl: asset.url,
      skills: parsed?.skills ?? [],
      resumeAssetId: asset.id,
    };
  }

  if (!profile?.resumeText) return null;
  const parsed = normalizeParsedResumeData(profile.parsedData ?? null);
  return {
    resumeText: profile.resumeText,
    resumeUrl: profile.resumeUrl,
    skills: parsed?.skills ?? [],
    resumeAssetId: null as string | null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role")?.trim();
  const force = searchParams.get("force") === "true";
  const assetId = searchParams.get("assetId")?.trim() || null;

  if (!role) return NextResponse.json({ error: "role required" }, { status: 400 });

  const { authUser, dbUser } = await getActingUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const source = await resolveResumeSource(dbUser.id, assetId, profile);
  if (!source) {
    return NextResponse.json({ error: "No resume found for this selection" }, { status: 404 });
  }

  const fingerprint = buildResumeFingerprint(source.resumeAssetId, source.resumeUrl, source.skills);
  const analyses = normalizeRoleAnalysesMap(profile?.roleAnalyses);
  const cached = getStoredRoleAnalysis(analyses, role, source.resumeAssetId);
  const stale = cached ? cached.resumeFingerprint !== fingerprint : false;

  if (!force && cached) {
    return NextResponse.json({
      ...cached,
      cached: true,
      stale,
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
    resumeSlice: source.resumeText.slice(0, 6000),
    declaredSkills: source.skills.length > 0 ? source.skills.join(", ") : "none listed",
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
      resumeAssetId: source.resumeAssetId,
    };

    await saveRoleAnalysis(dbUser.id, role, stored);

    return NextResponse.json({
      ...stored,
      cached: false,
      stale: false,
    });
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { authUser, dbUser } = await getActingUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role")?.trim();
  const assetId = searchParams.get("assetId")?.trim();

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const existing = normalizeRoleAnalysesMap(profile?.roleAnalyses);

  if (role && assetId) {
    if (existing[role]) {
      const nextRole = { ...existing[role] };
      delete nextRole[assetId];
      if (Object.keys(nextRole).length === 0) delete existing[role];
      else existing[role] = nextRole;
    }
    await prisma.profile.updateMany({
      where: { userId: dbUser.id },
      data: { roleAnalyses: existing as object },
    });
    return NextResponse.json({ ok: true });
  }

  if (role) {
    delete existing[role];
    await prisma.profile.updateMany({
      where: { userId: dbUser.id },
      data: { roleAnalyses: existing as object },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.profile.updateMany({
    where: { userId: dbUser.id },
    data: { roleAnalyses: {} },
  });

  return NextResponse.json({ ok: true });
}
