import { prisma } from "@/lib/prisma";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  buildResumeFingerprint,
  getStoredRoleAnalysis,
  normalizeRoleAnalysesMap,
  setStoredRoleAnalysis,
  type StoredRoleAnalysis,
} from "@/lib/role-gap";
import { jobMatchToRoleGap, roleJobDescription } from "@/lib/role-gap-from-match";
import { heuristicRoleGapAnalysis } from "@/lib/role-gap-heuristic";
import { ensureAssetResumeParsed } from "@/lib/ensure-asset-resume";
import { upsertProfileFields } from "@/lib/profile-write";
import { getActingUser } from "@/lib/acting-user";
import { normalizeParsedResumeData, parseJsonFromModel } from "@/lib/resume-parse";
import { fallbackJobMatch, type JobMatchResult } from "@/lib/resume-match";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { NextResponse } from "next/server";

async function saveRoleAnalysis(
  userId: string,
  role: string,
  analysis: StoredRoleAnalysis,
): Promise<void> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const existing = normalizeRoleAnalysesMap(profile?.roleAnalyses);
  const next = setStoredRoleAnalysis(existing, role, analysis);
  await upsertProfileFields(userId, { roleAnalyses: next as object });
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
  try {
    if (assetId) {
      const asset = await ensureAssetResumeParsed(assetId, userId);
      if (!asset?.resumeText?.trim()) {
        return { source: null, parseError: "Could not parse this resume file. Try re-uploading or use Reparse in Resumes." };
      }
      const parsed = normalizeParsedResumeData(asset.parsedData ?? null);
      return {
        source: {
          resumeText: asset.resumeText,
          resumeUrl: asset.url,
          skills: parsed?.skills ?? [],
          resumeAssetId: asset.id,
        },
        parseError: null as string | null,
      };
    }

    if (!profile?.resumeText?.trim()) {
      return { source: null, parseError: "No resume found for this selection" };
    }
    const parsed = normalizeParsedResumeData(profile.parsedData ?? null);
    return {
      source: {
        resumeText: profile.resumeText,
        resumeUrl: profile.resumeUrl,
        skills: parsed?.skills ?? [],
        resumeAssetId: null as string | null,
      },
      parseError: null as string | null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Resume parse failed";
    return { source: null, parseError: msg };
  }
}

function parseJobMatchFromText(text: string): JobMatchResult | null {
  const raw = parseJsonFromModel(text);
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const score = typeof obj.score === "number" ? obj.score : null;
  if (score === null) return null;
  const keywords = Array.isArray(obj.keywords)
    ? obj.keywords
        .map((k) => {
          if (!k || typeof k !== "object") return null;
          const row = k as Record<string, unknown>;
          const textVal = typeof row.text === "string" ? row.text : "";
          if (!textVal) return null;
          return { text: textVal, matched: row.matched === true };
        })
        .filter((k): k is { text: string; matched: boolean } => k !== null)
    : [];
  return {
    score,
    scoreLabel: typeof obj.scoreLabel === "string" ? obj.scoreLabel : "Good",
    keywords,
    summaryNote: typeof obj.summaryNote === "string" ? obj.summaryNote : undefined,
  };
}

async function analyzeRoleViaJobMatch(role: string, resumeText: string, userId: string): Promise<JobMatchResult> {
  const description = roleJobDescription(role);
  if (!isKimchiAiConfigured()) {
    return fallbackJobMatch(description, resumeText);
  }

  try {
    const template = await getPrompt("JOB_MATCH");
    const prompt = interpolate(template, {
      jobTitle: role,
      company: "Target role",
      description: description.slice(0, 4000),
      resumeSlice: resumeText.slice(0, 4000),
    });

    const { text, usage, modelId } = await kimchiGenerateText({
      tier: "analyze",
      prompt,
      maxOutputTokens: 1024,
      userId,
      tags: ["feature:role-gap"],
    });

    logAiUsage(userId, "FIT_ANALYSIS", modelId, usage.inputTokens, usage.outputTokens);

    const parsed = parseJobMatchFromText(text);
    if (parsed) return parsed;
  } catch {
    /* fall through */
  }

  return fallbackJobMatch(description, resumeText);
}

function storedFromAnalysis(
  roleGap: ReturnType<typeof jobMatchToRoleGap>,
  fingerprint: string,
  resumeAssetId: string | null,
): StoredRoleAnalysis {
  return {
    ...roleGap,
    analyzedAt: new Date().toISOString(),
    resumeFingerprint: fingerprint,
    resumeAssetId,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role")?.trim();
  const force = searchParams.get("force") === "true";
  const assetId = searchParams.get("assetId")?.trim() || null;

  if (!role) return NextResponse.json({ error: "role required" }, { status: 400 });

  try {
    const { authUser, dbUser } = await getActingUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const dbUserWithSub = await prisma.user.findUnique({
      where: { id: dbUser.id },
      include: { subscription: true },
    });
    if (!dbUserWithSub) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
    const { source, parseError } = await resolveResumeSource(dbUser.id, assetId, profile);
    if (!source) {
      return NextResponse.json({ error: parseError ?? "No resume found for this selection" }, { status: 404 });
    }

    const fingerprint = buildResumeFingerprint(source.resumeAssetId, source.resumeUrl, source.skills);
    const analyses = normalizeRoleAnalysesMap(profile?.roleAnalyses);
    const cached = getStoredRoleAnalysis(analyses, role, source.resumeAssetId);
    const stale = cached ? cached.resumeFingerprint !== fingerprint : false;

    if (!force && cached && !stale) {
      return NextResponse.json({
        ...cached,
        cached: true,
        stale: false,
        analyzedAt: cached.analyzedAt,
      });
    }

    if (isKimchiAiConfigured()) {
      const quotaError = await requireAiQuota(dbUserWithSub, "MATCH");
      if (quotaError) return quotaError;
    }

    const jobMatch = await analyzeRoleViaJobMatch(role, source.resumeText, dbUser.id);
    const roleGap = jobMatchToRoleGap(role, jobMatch);
    const stored = storedFromAnalysis(roleGap, fingerprint, source.resumeAssetId);
    await saveRoleAnalysis(dbUser.id, role, stored);

    return NextResponse.json({
      ...stored,
      cached: false,
      stale: false,
    });
  } catch (err) {
    console.error("[role-gap]", err);
    try {
      const { dbUser } = await getActingUser();
      if (!dbUser) return NextResponse.json({ error: "Analysis failed" }, { status: 500 });

      const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
      const asset = assetId
        ? await prisma.userAsset.findFirst({ where: { id: assetId, userId: dbUser.id, type: "RESUME" } })
        : null;
      const parsed = normalizeParsedResumeData(asset?.parsedData ?? profile?.parsedData ?? null);
      const skills = parsed?.skills ?? [];
      const heuristic = heuristicRoleGapAnalysis(role, skills);
      const fingerprint = buildResumeFingerprint(assetId, asset?.url ?? profile?.resumeUrl ?? null, skills);
      const stored: StoredRoleAnalysis = {
        ...heuristic,
        analyzedAt: new Date().toISOString(),
        resumeFingerprint: fingerprint,
        resumeAssetId: assetId,
      };
      await saveRoleAnalysis(dbUser.id, role, stored);
      return NextResponse.json({ ...stored, cached: false, stale: false, heuristic: true });
    } catch (fallbackErr) {
      console.error("[role-gap] fallback failed", fallbackErr);
      return NextResponse.json(
        {
          error: "Could not save analysis. Your profile may need onboarding completion.",
          code: "SAVE_FAILED",
        },
        { status: 500 },
      );
    }
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
