import { describe, expect, it } from "vitest";
import {
  hirebaseLevelsFromExperienceLabelSet,
  toggleJobrightExperienceLabel,
} from "@/lib/search-preferences";

describe("Jobright experience label selection", () => {
  it("keeps Senior Level and Lead / Staff independent", () => {
    let labels = new Set<string>();
    labels = toggleJobrightExperienceLabel(labels, "Senior Level");
    expect([...labels]).toEqual(["Senior Level"]);
    expect(hirebaseLevelsFromExperienceLabelSet(labels)).toEqual(["Senior"]);

    labels = toggleJobrightExperienceLabel(labels, "Lead / Staff");
    expect([...labels].sort()).toEqual(["Lead / Staff", "Senior Level"]);
    expect(hirebaseLevelsFromExperienceLabelSet(labels)).toEqual(["Senior"]);
  });

  it("does not auto-select Lead / Staff when toggling Senior Level", () => {
    const labels = toggleJobrightExperienceLabel(new Set(), "Senior Level");
    expect(labels.has("Lead / Staff")).toBe(false);
  });
});
