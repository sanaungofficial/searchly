export const SKILLS_GROUP_LABEL = "Skills";
export const TOOLS_GROUP_LABEL = "Tools & tech stack";

export type SkillGroupLike = {
  id: string;
  label: string;
  skills: string[];
};

export type SkillsToolsBuckets = {
  skills: string[];
  tools: string[];
};

const TOOLS_LABEL_RE =
  /technical|tools?|technologies|tech stack|platforms|software|languages?|frameworks?|programming|stack/i;

export function isToolsGroupLabel(label: string): boolean {
  return TOOLS_LABEL_RE.test(label.trim());
}

function dedupeList(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function bucketsFromSkillGroups(groups: SkillGroupLike[]): SkillsToolsBuckets {
  const skills: string[] = [];
  const tools: string[] = [];
  for (const group of groups) {
    if (isToolsGroupLabel(group.label)) {
      tools.push(...group.skills);
    } else {
      skills.push(...group.skills);
    }
  }
  return { skills: dedupeList(skills), tools: dedupeList(tools) };
}

export function syncSkillGroupsFromBuckets(skills: string[], tools: string[]): SkillGroupLike[] {
  const groups: SkillGroupLike[] = [];
  if (skills.length) {
    groups.push({ id: "sg_skills", label: SKILLS_GROUP_LABEL, skills: dedupeList(skills) });
  }
  if (tools.length) {
    groups.push({ id: "sg_tools", label: TOOLS_GROUP_LABEL, skills: dedupeList(tools) });
  }
  return groups;
}

export function allMatchableSkills(buckets: SkillsToolsBuckets): string[] {
  return dedupeList([...(buckets.skills ?? []), ...(buckets.tools ?? [])]);
}

export function reconcileSkillsToolsFields(input: {
  skills?: string[];
  tools?: string[];
  skillGroups?: SkillGroupLike[];
}): SkillsToolsBuckets & { skillGroups: SkillGroupLike[] } {
  const rawGroups = input.skillGroups ?? [];
  const fromGroups = rawGroups.length ? bucketsFromSkillGroups(rawGroups) : null;

  let skills = dedupeList(fromGroups?.skills.length ? fromGroups.skills : input.skills ?? []);
  let tools = dedupeList(fromGroups?.tools.length ? fromGroups.tools : input.tools ?? []);

  if (rawGroups.length && !fromGroups?.tools.length && !fromGroups?.skills.length) {
    const split = bucketsFromSkillGroups(rawGroups);
    skills = dedupeList([...skills, ...split.skills]);
    tools = dedupeList([...tools, ...split.tools]);
  }

  const toolKeys = new Set(tools.map((t) => t.toLowerCase()));
  skills = skills.filter((s) => !toolKeys.has(s.toLowerCase()));

  const skillGroups =
    rawGroups.length > 0
      ? rawGroups.map((group, index) => ({
          id: group.id || `sg_${index}`,
          label: group.label.trim() || SKILLS_GROUP_LABEL,
          skills: dedupeList(group.skills),
        }))
      : syncSkillGroupsFromBuckets(skills, tools);

  return { skills, tools, skillGroups };
}

export function skillGroupsForEditor(input: SkillsToolsBuckets & { skillGroups?: SkillGroupLike[] }): SkillGroupLike[] {
  const reconciled = reconcileSkillsToolsFields(input);
  if (reconciled.skillGroups.length >= 2) return reconciled.skillGroups;
  if (reconciled.skillGroups.length === 1) {
    const only = reconciled.skillGroups[0]!;
    if (isToolsGroupLabel(only.label)) {
      return [
        { id: "sg_skills", label: SKILLS_GROUP_LABEL, skills: [] },
        only,
      ];
    }
    return [only, { id: "sg_tools", label: TOOLS_GROUP_LABEL, skills: reconciled.tools }];
  }
  return syncSkillGroupsFromBuckets(reconciled.skills, reconciled.tools);
}

export function patchFromSkillGroups(skillGroups: SkillGroupLike[]): SkillsToolsBuckets & { skillGroups: SkillGroupLike[] } {
  return reconcileSkillsToolsFields({ skillGroups });
}
