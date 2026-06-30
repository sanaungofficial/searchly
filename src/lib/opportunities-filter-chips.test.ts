import { describe, expect, it } from "vitest";
import {
  buildOpportunitiesFilterChips,
  opportunitiesDrawerTitle,
  removeOpportunitiesFilterChip,
} from "./opportunities-filter-chips";
import { emptyExtendedFilterFields } from "./search-preferences";
import type { RecommendedFilterForm } from "@/components/scout/pipeline-recommended-filters";

function baseForm(overrides: Partial<RecommendedFilterForm> = {}): RecommendedFilterForm {
  return {
    semanticQuery: "",
    jobTitles: "",
    keywords: "",
    companyName: "",
    industries: "",
    subindustries: "",
    jobCategories: "",
    locationCity: "",
    locationRegion: "",
    locationCountry: "",
    locationRadiusMiles: "",
    datePostedWithinDays: "",
    datePostedFrom: "",
    salaryFrom: "",
    salaryTo: "",
    yearsFrom: "",
    yearsTo: "",
    jobBoard: "",
    locationTypes: new Set(),
    jobTypes: new Set(),
    experienceLevels: new Set(),
    experienceLevelLabels: new Set(),
    companySizeBuckets: new Set(),
    visaSponsored: false,
    relocationPriorities: [],
    ...emptyExtendedFilterFields(),
    ...overrides,
  };
}

describe("buildOpportunitiesFilterChips", () => {
  it("excludes target-role bleed from job function chips", () => {
    const form = baseForm({
      jobCategories: "Marketing Jobs",
      customJobFunctions: ["Yarmulke", "Jaffa"],
    });
    const chips = buildOpportunitiesFilterChips(form, {
      excludeTargetRoleBleed: ["Yarmulke", "Jaffa"],
    });
    expect(chips.map((c) => c.label)).toEqual(["Marketing"]);
  });

  it("builds drawer title like Jobright", () => {
    const form = baseForm({
      jobCategories: "Marketing Jobs, Operations Jobs, Sales Jobs",
      locationCountry: "United States",
      locationAllInCountry: true,
    });
    expect(opportunitiesDrawerTitle(form)).toBe("Marketing + 2 roles, US");
  });
});

describe("removeOpportunitiesFilterChip", () => {
  it("removes a job function chip from taxonomy and custom lists", () => {
    const form = baseForm({
      jobCategories: "Marketing Jobs",
      customJobFunctions: ["Growth"],
    });
    const chip = buildOpportunitiesFilterChips(form).find((c) => c.label === "Marketing")!;
    const next = removeOpportunitiesFilterChip(form, chip);
    expect(next.jobCategories).toBe("");
    expect(next.customJobFunctions).toEqual(["Growth"]);
  });
});
