import { ROLE_ARCHETYPES } from "@/components/scout/workspace-data";
import type { RoleGapAnalysis } from "@/lib/role-gap";
import type { JobMatchResult } from "@/lib/resume-match";

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

export function roleArchetypeKey(role: string): string {
  return ROLE_ARCHETYPE_ALIASES[role] ?? role;
}

export function roleJobDescription(role: string): string {
  const key = roleArchetypeKey(role);
  const archetype = ROLE_ARCHETYPES[key];
  if (archetype) {
    return `${role}\n\n${archetype.description}\n\nKey requirements:\n${archetype.requires.map((s) => `- ${s}`).join("\n")}`;
  }
  return `${role}\n\nSenior professional role requiring strategic leadership, cross-functional influence, and domain expertise relevant to this level.`;
}

export function archetypeSkillsForRole(role: string): string[] {
  const key = roleArchetypeKey(role);
  return ROLE_ARCHETYPES[key]?.requires ?? [
    "Strategic Analysis",
    "Stakeholder Management",
    "Data Analysis",
    "Executive Communication",
    "Cross-functional Leadership",
  ];
}

/** Map proven job-match output into Target Roles UI shape. */
export function jobMatchToRoleGap(role: string, match: JobMatchResult): RoleGapAnalysis {
  const keywords = match.keywords ?? [];
  const requiredSkills = keywords.length
    ? keywords.map((k) => k.text).slice(0, 10)
    : archetypeSkillsForRole(role);

  const missing = keywords.filter((k) => !k.matched);
  const gaps = (missing.length ? missing : keywords.slice(0, 3).map((k) => ({ ...k, matched: false })))
    .slice(0, 3)
    .map((k) => ({
      skill: k.text,
      why: `Important for ${role} — ${k.matched ? "partially present" : "not detected in your resume"}.`,
    }));

  const fitScore = Math.min(100, Math.max(0, Math.round(match.score * 10)));

  return {
    fitScore,
    summary:
      match.summaryNote?.trim() ||
      `You have a ${match.scoreLabel?.toLowerCase() ?? "moderate"} foundation for ${role}.`,
    requiredSkills,
    gaps,
    nextSteps: gaps.map((g) => `Highlight or build experience with ${g.skill}.`).slice(0, 2),
  };
}
