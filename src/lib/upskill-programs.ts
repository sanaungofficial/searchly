import { UPSKILL_CATALOG, type UpskillCatalogEntry } from "@/lib/upskill-catalog";
import type { MatchableKind } from "@/lib/skills-tools";

export type UpskillProgramType = "course" | "certification" | "search";

export type SkillGoalGapSource = "saved_job" | "corpus" | "archetype" | "manual";

export interface UpskillProgram {
  id: string;
  name: string;
  platform: string;
  url: string;
  duration?: string;
  credential?: string;
  type: UpskillProgramType;
  source: "catalog" | "search";
  kimchiPick?: boolean;
  why?: string;
}

export interface SkillGoalRecord {
  skill: string;
  role: string;
  addedAt: string;
  programs: UpskillProgram[];
  gapSource?: SkillGoalGapSource;
  kind?: MatchableKind;
}

export function skillGoalGapSourceLabel(source: SkillGoalGapSource | undefined): string | null {
  if (source === "saved_job") return "From saved job";
  if (source === "corpus") return "From job postings";
  if (source === "archetype") return "From role analysis";
  return null;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function tokens(value: string): string[] {
  return normalizeToken(value).split(/[\s/&,+-]+/).filter(Boolean);
}

export function skillMatchesLabel(skill: string, label: string): boolean {
  const a = normalizeToken(skill);
  const b = normalizeToken(label);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aTokens = tokens(skill);
  const bTokens = tokens(label);
  return aTokens.some((t) => bTokens.includes(t) && t.length >= 3);
}

function programTypeFromCredential(credential: string | undefined): UpskillProgramType {
  if (!credential) return "course";
  const lower = credential.toLowerCase();
  if (lower.includes("cert") || lower.includes("badge")) return "certification";
  return "course";
}

function catalogEntryToProgram(entry: UpskillCatalogEntry): UpskillProgram {
  return {
    id: entry.legacyNumericId != null ? `catalog_${entry.legacyNumericId}` : `catalog_${entry.id}`,
    name: entry.title,
    platform: entry.provider,
    url: entry.url,
    duration: entry.duration,
    credential: entry.credential,
    type: programTypeFromCredential(entry.credential),
    source: "catalog",
    kimchiPick: entry.kimchiPick,
    why: entry.why,
  };
}

function searchProgramsForSkill(skill: string): UpskillProgram[] {
  const query = encodeURIComponent(skill);
  return [
    {
      id: `search_coursera_${normalizeToken(skill).replace(/\s+/g, "_")}`,
      name: `Courses for "${skill}"`,
      platform: "Coursera",
      url: `https://www.coursera.org/search?query=${query}`,
      type: "search",
      source: "search",
      kimchiPick: false,
    },
    {
      id: `search_linkedin_${normalizeToken(skill).replace(/\s+/g, "_")}`,
      name: `Training for "${skill}"`,
      platform: "LinkedIn Learning",
      url: `https://www.linkedin.com/learning/search?keywords=${query}`,
      type: "search",
      source: "search",
      kimchiPick: false,
    },
    {
      id: `search_certs_${normalizeToken(skill).replace(/\s+/g, "_")}`,
      name: `Certifications for "${skill}"`,
      platform: "Web search",
      url: `https://www.google.com/search?q=${query}+professional+certification+training`,
      type: "certification",
      source: "search",
      kimchiPick: false,
    },
  ];
}

export function findProgramsForSkill(skill: string, limit = 4): UpskillProgram[] {
  const matches: UpskillProgram[] = [];
  const seen = new Set<string>();

  for (const entry of UPSKILL_CATALOG) {
    const gapHit = entry.closesGap.some((gap) => skillMatchesLabel(skill, gap));
    const titleHit = skillMatchesLabel(skill, entry.title);
    const whyHit = entry.why ? skillMatchesLabel(skill, entry.why) : false;
    if (!gapHit && !titleHit && !whyHit) continue;

    const program = catalogEntryToProgram(entry);
    if (seen.has(program.id)) continue;
    seen.add(program.id);
    matches.push(program);
  }

  if (matches.length < limit) {
    for (const program of searchProgramsForSkill(skill)) {
      if (matches.length >= limit) break;
      if (seen.has(program.id)) continue;
      seen.add(program.id);
      matches.push(program);
    }
  }

  return matches.slice(0, limit);
}

export function buildSkillGoal(
  skill: string,
  role: string,
  gapSource?: SkillGoalGapSource,
  kind?: MatchableKind,
): SkillGoalRecord {
  return {
    skill,
    role,
    addedAt: new Date().toISOString(),
    programs: findProgramsForSkill(skill),
    ...(gapSource ? { gapSource } : {}),
    ...(kind ? { kind } : {}),
  };
}

export function normalizeSkillGoals(raw: unknown): SkillGoalRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: SkillGoalRecord[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const skill = typeof row.skill === "string" ? row.skill.trim() : "";
    const role = typeof row.role === "string" ? row.role.trim() : "";
    const addedAt = typeof row.addedAt === "string" ? row.addedAt : new Date().toISOString();
    if (!skill || !role) continue;

    let programs: UpskillProgram[] = [];
    if (Array.isArray(row.programs)) {
      programs = row.programs
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const prog = p as Record<string, unknown>;
          const name = typeof prog.name === "string" ? prog.name.trim() : "";
          const platform = typeof prog.platform === "string" ? prog.platform.trim() : "";
          const url = typeof prog.url === "string" ? prog.url.trim() : "";
          const id = typeof prog.id === "string" ? prog.id : `prog_${name}`;
          if (!name || !platform || !url) return null;
          return {
            id,
            name,
            platform,
            url,
            duration: typeof prog.duration === "string" ? prog.duration : undefined,
            credential: typeof prog.credential === "string" ? prog.credential : undefined,
            type: (prog.type === "course" || prog.type === "certification" || prog.type === "search"
              ? prog.type
              : "course") as UpskillProgramType,
            source: (prog.source === "catalog" || prog.source === "search" ? prog.source : "search") as "catalog" | "search",
            kimchiPick: prog.kimchiPick === true || prog.source === "catalog",
            why: typeof prog.why === "string" ? prog.why : undefined,
          };
        })
        .filter((p): p is UpskillProgram => p !== null);
    }

    if (!programs.length) programs = findProgramsForSkill(skill);
    const gapSource =
      row.gapSource === "saved_job" ||
      row.gapSource === "corpus" ||
      row.gapSource === "archetype" ||
      row.gapSource === "manual"
        ? row.gapSource
        : undefined;
    const kind = row.kind === "skill" || row.kind === "technology" ? row.kind : undefined;
    out.push({
      skill,
      role,
      addedAt,
      programs,
      ...(gapSource ? { gapSource } : {}),
      ...(kind ? { kind } : {}),
    });
  }
  return out;
}

export type UpskillProgressMap = Record<string, "none" | "inprogress" | "completed">;

export function normalizeUpskillProgress(raw: unknown): UpskillProgressMap {
  if (!raw || typeof raw !== "object") return {};
  const out: UpskillProgressMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "none" || value === "inprogress" || value === "completed") {
      out[key] = value;
    }
  }
  return out;
}
