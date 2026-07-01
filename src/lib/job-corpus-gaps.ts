import { parseJobMetaFromNotes } from "@/lib/client-import/enrich-jobs";
import { computeJobSkillsOverlap, extractProfileSkills } from "@/lib/job-fit-ranking";
import { fetchHirebaseRoleMatchingJobs, isHirebaseConfigured } from "@/lib/hirebase";
import { jobTitleMatchesRolePattern } from "@/lib/role-title-preferences";
import { mergeParsedWithReadback, normalizeParsedResumeData, type ParsedResumeData } from "@/lib/resume-parse";
import { classifyMatchableKind, type MatchableKind } from "@/lib/skills-tools";
import { dedupeRolesPreserveOrder } from "@/lib/target-roles-unified";
import { prisma } from "@/lib/prisma";

export const ROLE_CORPUS_GAPS_KEY = "roleCorpusGaps";

export type CorpusGapSource = "corpus" | "saved_job" | "archetype";

export type RoleCorpusGapItem = {
  skill: string;
  kind: MatchableKind;
  count: number;
  sources: CorpusGapSource[];
  /** Higher ranks first when merging across sources. */
  rankScore: number;
};

export type RoleCorpusGapsByRole = {
  role: string;
  gaps: RoleCorpusGapItem[];
  jobCount: number;
  savedJobCount: number;
};

export type RoleCorpusGapsCache = {
  version: 1;
  refreshedAt: string;
  byRole: Record<string, RoleCorpusGapsByRole>;
};

const MAX_ROLES = 5;
const JOBS_PER_ROLE = 30;
const TOP_GAPS_PER_ROLE = 12;

const SOURCE_RANK: Record<CorpusGapSource, number> = {
  saved_job: 1000,
  corpus: 100,
  archetype: 0,
};

function normalizeSkillKey(skill: string): string {
  return skill.trim().toLowerCase();
}

function userHasSkill(skill: string, profileSkills: string[]): boolean {
  const key = normalizeSkillKey(skill);
  return profileSkills.some((s) => normalizeSkillKey(s) === key);
}

function mergeGapItem(
  map: Map<string, RoleCorpusGapItem>,
  skill: string,
  source: CorpusGapSource,
  kind: MatchableKind,
  countDelta = 1,
) {
  const trimmed = skill.trim();
  if (!trimmed) return;
  const key = normalizeSkillKey(trimmed);
  const existing = map.get(key);
  const sourceRank = SOURCE_RANK[source];
  if (existing) {
    existing.count += countDelta;
    if (!existing.sources.includes(source)) existing.sources.push(source);
    existing.rankScore = Math.max(existing.rankScore, sourceRank + existing.count);
    if (existing.kind === "skill" && kind === "technology") existing.kind = kind;
    return;
  }
  map.set(key, {
    skill: trimmed,
    kind,
    count: countDelta,
    sources: [source],
    rankScore: sourceRank + countDelta,
  });
}

function roleKey(role: string): string {
  return role.trim().toLowerCase();
}

function matchJobToTargetRole(jobTitle: string, targetRoles: string[]): string | null {
  for (const role of targetRoles) {
    if (jobTitleMatchesRolePattern(jobTitle, role)) return role;
  }
  return null;
}

function aggregateCorpusGapsForRole(
  role: string,
  rawJobs: Array<{ skills?: string[]; technologies?: string[] }>,
  profileSkills: string[],
): RoleCorpusGapItem[] {
  const map = new Map<string, RoleCorpusGapItem>();
  for (const job of rawJobs) {
    const labeledTerms: Array<{ term: string; kind: MatchableKind }> = [
      ...(job.skills ?? []).map((s) => ({ term: s.trim(), kind: "skill" as const })),
      ...(job.technologies ?? []).map((s) => ({ term: s.trim(), kind: "technology" as const })),
    ].filter((entry) => entry.term);
    const jobSkillTerms = labeledTerms.map((entry) => entry.term);
    const overlap = computeJobSkillsOverlap(jobSkillTerms, profileSkills);
    const gaps =
      overlap.matchedSkills.length > 0
        ? labeledTerms.filter((entry) => !overlap.matchedSkills.includes(entry.term))
        : labeledTerms;
    for (const { term, kind } of gaps) {
      if (userHasSkill(term, profileSkills)) continue;
      mergeGapItem(map, term, "corpus", kind);
    }
  }

  return [...map.values()]
    .sort((a, b) => b.rankScore - a.rankScore || b.count - a.count || a.skill.localeCompare(b.skill))
    .slice(0, TOP_GAPS_PER_ROLE);
}

async function loadSavedJobGapsByRole(
  userId: string,
  targetRoles: string[],
): Promise<Map<string, RoleCorpusGapItem[]>> {
  const rows = await prisma.job.findMany({
    where: { userId },
    select: { role: true, notes: true },
  });

  const byRole = new Map<string, Map<string, RoleCorpusGapItem>>();
  for (const role of targetRoles) {
    byRole.set(roleKey(role), new Map());
  }

  for (const row of rows) {
    const matchedRole = matchJobToTargetRole(row.role, targetRoles);
    if (!matchedRole) continue;
    const meta = parseJobMetaFromNotes(row.notes);
    const gapSkills = meta?.vectorMatch?.gapSkills ?? [];
    if (!gapSkills.length) continue;

    const bucket = byRole.get(roleKey(matchedRole))!;
    for (const skill of gapSkills) {
      mergeGapItem(bucket, skill, "saved_job", classifyMatchableKind(skill));
    }
  }

  const out = new Map<string, RoleCorpusGapItem[]>();
  for (const role of targetRoles) {
    const items = [...(byRole.get(roleKey(role))?.values() ?? [])]
      .sort((a, b) => b.rankScore - a.rankScore || a.skill.localeCompare(b.skill))
      .slice(0, TOP_GAPS_PER_ROLE);
    out.set(roleKey(role), items);
  }
  return out;
}

function mergeRoleGapLists(
  corpus: RoleCorpusGapItem[],
  saved: RoleCorpusGapItem[],
): RoleCorpusGapItem[] {
  const map = new Map<string, RoleCorpusGapItem>();
  for (const item of [...saved, ...corpus]) {
    for (const source of item.sources) {
      mergeGapItem(map, item.skill, source, item.kind, item.count);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.rankScore - a.rankScore || b.count - a.count || a.skill.localeCompare(b.skill))
    .slice(0, TOP_GAPS_PER_ROLE);
}

export function readRoleCorpusGaps(parsedData: unknown): RoleCorpusGapsCache | null {
  if (!parsedData || typeof parsedData !== "object") return null;
  const raw = (parsedData as Record<string, unknown>)[ROLE_CORPUS_GAPS_KEY];
  if (!raw || typeof raw !== "object") return null;
  const cache = raw as RoleCorpusGapsCache;
  if (cache.version !== 1 || typeof cache.refreshedAt !== "string" || !cache.byRole) return null;
  const byRole: RoleCorpusGapsCache["byRole"] = {};
  for (const [key, entry] of Object.entries(cache.byRole)) {
    byRole[key] = {
      ...entry,
      gaps: (entry.gaps ?? []).map((gap) => ({
        ...gap,
        kind: gap.kind === "skill" || gap.kind === "technology" ? gap.kind : classifyMatchableKind(gap.skill),
      })),
    };
  }
  return { ...cache, byRole };
}

export function writeRoleCorpusGaps(
  parsedData: Record<string, unknown> | null | undefined,
  cache: RoleCorpusGapsCache,
): Record<string, unknown> {
  const base = parsedData && typeof parsedData === "object" ? { ...parsedData } : {};
  return { ...base, [ROLE_CORPUS_GAPS_KEY]: cache };
}

export type RefreshRoleCorpusGapsInput = {
  userId: string;
  targetRoles: string[];
  parsedData?: unknown;
  readbackData?: unknown;
};

export async function refreshRoleCorpusGaps(
  input: RefreshRoleCorpusGapsInput,
): Promise<RoleCorpusGapsCache> {
  const roles = dedupeRolesPreserveOrder(input.targetRoles).slice(0, MAX_ROLES);
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(input.parsedData ?? null),
    input.readbackData,
  );
  const profileSkills = extractProfileSkills(parsedData as ParsedResumeData | null);
  const savedByRole = await loadSavedJobGapsByRole(input.userId, roles);

  const byRole: Record<string, RoleCorpusGapsByRole> = {};

  if (!roles.length) {
    return { version: 1, refreshedAt: new Date().toISOString(), byRole };
  }

  if (isHirebaseConfigured()) {
    await Promise.all(
      roles.map(async (role) => {
        try {
          const result = await fetchHirebaseRoleMatchingJobs({
            matchRoles: [role],
            filters: { limit: JOBS_PER_ROLE, page: 1 },
          });
          const corpusGaps = aggregateCorpusGapsForRole(role, result.rawJobs, profileSkills);
          const savedGaps = savedByRole.get(roleKey(role)) ?? [];
          byRole[roleKey(role)] = {
            role,
            gaps: mergeRoleGapLists(corpusGaps, savedGaps),
            jobCount: result.rawJobs.length,
            savedJobCount: savedGaps.length,
          };
        } catch (err) {
          console.error("[role-corpus-gaps] Hirebase fetch failed for role:", role, err);
          const savedGaps = savedByRole.get(roleKey(role)) ?? [];
          byRole[roleKey(role)] = {
            role,
            gaps: savedGaps,
            jobCount: 0,
            savedJobCount: savedGaps.length,
          };
        }
      }),
    );
  } else {
    for (const role of roles) {
      const savedGaps = savedByRole.get(roleKey(role)) ?? [];
      byRole[roleKey(role)] = {
        role,
        gaps: savedGaps,
        jobCount: 0,
        savedJobCount: savedGaps.length,
      };
    }
  }

  return {
    version: 1,
    refreshedAt: new Date().toISOString(),
    byRole,
  };
}

export function corpusGapsForRole(
  cache: RoleCorpusGapsCache | null | undefined,
  role: string,
): RoleCorpusGapItem[] {
  if (!cache) return [];
  return cache.byRole[roleKey(role)]?.gaps ?? [];
}

export function corpusGapSourceLabel(source: CorpusGapSource): string {
  if (source === "saved_job") return "Saved job";
  if (source === "corpus") return "Job postings";
  return "Role analysis";
}
