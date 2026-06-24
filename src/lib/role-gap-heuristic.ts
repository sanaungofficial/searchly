import { ROLE_ARCHETYPES } from "@/components/scout/workspace-data";
import type { RoleGapAnalysis } from "@/lib/role-gap";

/** Map legacy / bucket titles to ROLE_ARCHETYPES keys for heuristic skill matching. */
const ROLE_ARCHETYPE_ALIASES: Record<string, string> = {
  "Strategy Manager": "Senior Manager, Corporate Strategy",
  "Senior Strategy Manager": "Director of Corporate Strategy",
  "Director of Strategy": "Director of Corporate Strategy",
  "Chief Strategy Officer (CSO)": "Chief Strategy Officer",
  "Head of Corporate Development": "Director of Corporate Development",
  "Business Operations Manager": "Head of Strategy & Operations",
  "Director of Operations": "Director of Strategy & Operations",
  "VP of Operations": "VP of Business Operations",
};

const GENERIC_ROLE_SKILLS = [
  "Strategic Analysis",
  "Stakeholder Management",
  "Data Analysis",
  "Executive Communication",
  "Cross-functional Leadership",
];

function skillsOverlap(a: string, b: string): boolean {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (!la || !lb) return false;
  return la === lb || la.includes(lb) || lb.includes(la);
}

function requiredSkillsForRole(role: string): string[] {
  const key = ROLE_ARCHETYPE_ALIASES[role] ?? role;
  const archetype = ROLE_ARCHETYPES[key];
  if (archetype?.requires?.length) return archetype.requires;
  return GENERIC_ROLE_SKILLS;
}

/** Dev / no-AI fallback: score resume skills against known role requirements. */
export function heuristicRoleGapAnalysis(role: string, resumeSkills: string[]): RoleGapAnalysis {
  const requiredSkills = requiredSkillsForRole(role);
  const missing = requiredSkills.filter(
    (req) => !resumeSkills.some((s) => skillsOverlap(s, req)),
  );
  const fitScore = requiredSkills.length
    ? Math.round(((requiredSkills.length - missing.length) / requiredSkills.length) * 100)
    : 50;

  return {
    fitScore,
    summary: `Heuristic fit estimate for ${role} based on your parsed resume skills. Full AI analysis is available on production.`,
    requiredSkills,
    gaps: missing.map((skill) => ({
      skill,
      why: `Not detected in your resume — commonly expected for ${role}.`,
    })),
    nextSteps: missing.slice(0, 3).map((s) => `Build or highlight experience with ${s}.`),
  };
}
