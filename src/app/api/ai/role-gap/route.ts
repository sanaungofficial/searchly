import { prisma } from "@/lib/prisma";
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
import { getActingUser } from "@/lib/acting-user";
import { normalizeParsedResumeData, parseJsonFromModel } from "@/lib/resume-parse";
import { fallbackJobMatch, type JobMatchResult } from "@/lib/resume-match";
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
  try {
    if (assetId) {
      const asset = await ensureAssetResumeParsed(assetId, userId);
      if (!asset?.resumeText?.trim()) {
        return { source: null, parseError: "Could not parse this resume file. Try re-uploading or use Reparse in Assets." };
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

async function analyzeRoleViaJobMatch(role: string, resumeText: string): Promise<JobMatchResult> {
  const description = roleJobDescription(role);
  if (!process.env.ANTHROPIC_API_KEY) {
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

    const message = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected AI response");

    const parsed = parseJobMatchFromText(content.text);
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

    const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
    const { source, parseError } = await resolveResumeSource(dbUser.id, assetId, profile);
    if (!source) {
      return NextResponse.json({ error: parseError ?? "No resume found for this selection" }, { status: 404 });
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

    const jobMatch = await analyzeRoleViaJobMatch(role, source.resumeText);
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
    } catch {
      return NextResponse.json({ error: "Analysis failed — try again in a moment." }, { status: 500 });
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
