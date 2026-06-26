import { describe, expect, it } from "vitest";
import {
  allMatchableSkills,
  bucketsFromSkillGroups,
  isToolsGroupLabel,
  reconcileSkillsToolsFields,
} from "@/lib/skills-tools";

describe("isToolsGroupLabel", () => {
  it("detects technical group labels", () => {
    expect(isToolsGroupLabel("Technical Skills")).toBe(true);
    expect(isToolsGroupLabel("Tools & tech stack")).toBe(true);
    expect(isToolsGroupLabel("Skills")).toBe(false);
  });
});

describe("reconcileSkillsToolsFields", () => {
  it("splits legacy skill groups into skills and tools buckets", () => {
    const result = reconcileSkillsToolsFields({
      skills: [],
      tools: [],
      skillGroups: [
        { id: "sg_0", label: "Skills", skills: ["Stakeholder management"] },
        { id: "sg_1", label: "Technical Skills", skills: ["Python", "SQL"] },
      ],
    });

    expect(result.skills).toEqual(["Stakeholder management"]);
    expect(result.tools).toEqual(["Python", "SQL"]);
  });

  it("keeps explicit tools field separate from skills", () => {
    const result = reconcileSkillsToolsFields({
      skills: ["Strategy"],
      tools: ["Excel"],
      skillGroups: [],
    });

    expect(result.skills).toEqual(["Strategy"]);
    expect(result.tools).toEqual(["Excel"]);
    expect(allMatchableSkills(result)).toEqual(["Strategy", "Excel"]);
  });
});

describe("bucketsFromSkillGroups", () => {
  it("routes items by group label", () => {
    expect(
      bucketsFromSkillGroups([
        { id: "1", label: "Core competencies", skills: ["Operating model design"] },
        { id: "2", label: "Tools", skills: ["Tableau"] },
      ]),
    ).toEqual({
      skills: ["Operating model design"],
      tools: ["Tableau"],
    });
  });
});
