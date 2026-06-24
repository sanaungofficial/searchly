export interface RoleGapAnalysis {
  fitScore: number;
  summary: string;
  requiredSkills: string[];
  gaps: { skill: string; why: string }[];
  nextSteps: string[];
}

export interface StoredRoleAnalysis extends RoleGapAnalysis {
  analyzedAt: string;
  resumeFingerprint: string;
  resumeAssetId?: string | null;
}

/** role → resume key → analysis (one cached result per role + resume). */
export type RoleAnalysesMap = Record<string, Record<string, StoredRoleAnalysis>>;

export function resumeAnalysisKey(resumeAssetId: string | null | undefined): string {
  return resumeAssetId ?? "primary";
}

export function buildResumeFingerprint(
  resumeAssetId: string | null | undefined,
  resumeUrl: string | null | undefined,
  skills: string[],
): string {
  const normalizedSkills = [...skills].map((s) => s.trim().toLowerCase()).filter(Boolean).sort().join("|");
  return `${resumeAssetId ?? "primary"}::${resumeUrl ?? ""}::${normalizedSkills}`;
}

export function normalizeRoleGapAnalysis(raw: unknown): RoleGapAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const fitScore = typeof obj.fitScore === "number" ? Math.round(obj.fitScore) : null;
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  if (fitScore === null || !summary) return null;

  const requiredSkills = Array.isArray(obj.requiredSkills)
    ? obj.requiredSkills.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const gaps = Array.isArray(obj.gaps)
    ? obj.gaps
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const row = entry as Record<string, unknown>;
          const skill = typeof row.skill === "string" ? row.skill.trim() : "";
          const why = typeof row.why === "string" ? row.why.trim() : "";
          if (!skill) return null;
          return { skill, why };
        })
        .filter((g): g is { skill: string; why: string } => g !== null)
    : [];

  const nextSteps = Array.isArray(obj.nextSteps)
    ? obj.nextSteps.map((s) => String(s).trim()).filter(Boolean)
    : [];

  return { fitScore, summary, requiredSkills, gaps, nextSteps };
}

function normalizeSingleStored(value: unknown): StoredRoleAnalysis | null {
  const analysis = normalizeRoleGapAnalysis(value);
  if (!analysis) return null;
  const meta = value as Record<string, unknown>;
  const analyzedAt = typeof meta.analyzedAt === "string" ? meta.analyzedAt : new Date(0).toISOString();
  const resumeFingerprint = typeof meta.resumeFingerprint === "string" ? meta.resumeFingerprint : "";
  const resumeAssetId = typeof meta.resumeAssetId === "string" ? meta.resumeAssetId : null;
  return { ...analysis, analyzedAt, resumeFingerprint, resumeAssetId };
}

function isStoredRoleAnalysisShape(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && "fitScore" in value;
}

export function getStoredRoleAnalysis(
  map: RoleAnalysesMap,
  role: string,
  resumeAssetId: string | null | undefined,
): StoredRoleAnalysis | undefined {
  return map[role]?.[resumeAnalysisKey(resumeAssetId)];
}

export function setStoredRoleAnalysis(
  map: RoleAnalysesMap,
  role: string,
  analysis: StoredRoleAnalysis,
): RoleAnalysesMap {
  const key = resumeAnalysisKey(analysis.resumeAssetId);
  return {
    ...map,
    [role]: {
      ...(map[role] ?? {}),
      [key]: analysis,
    },
  };
}

export function normalizeRoleAnalysesMap(raw: unknown): RoleAnalysesMap {
  if (!raw || typeof raw !== "object") return {};
  const out: RoleAnalysesMap = {};
  for (const [role, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;

    if (isStoredRoleAnalysisShape(value)) {
      const analysis = normalizeSingleStored(value);
      if (!analysis) continue;
      out[role] = { [resumeAnalysisKey(analysis.resumeAssetId)]: analysis };
      continue;
    }

    const bucket: Record<string, StoredRoleAnalysis> = {};
    for (const [resumeKey, entry] of Object.entries(value as Record<string, unknown>)) {
      const analysis = normalizeSingleStored(entry);
      if (analysis) bucket[resumeKey] = analysis;
    }
    if (Object.keys(bucket).length > 0) out[role] = bucket;
  }
  return out;
}

export function isRoleAnalysisStale(
  stored: StoredRoleAnalysis | undefined,
  fingerprint: string,
): boolean {
  if (!stored) return true;
  return stored.resumeFingerprint !== fingerprint;
}

export const LEGACY_ANALYSIS_CACHE_KEY = (role: string) =>
  `kimchi_analysis_${role.replace(/\W+/g, "_")}`;
