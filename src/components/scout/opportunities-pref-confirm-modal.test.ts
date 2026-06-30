import { describe, expect, it } from "vitest";
import {
  hasOpportunitiesSearchPrefs,
  shouldShowOpportunitiesPrefConfirm,
} from "@/components/scout/opportunities-pref-confirm-modal";

describe("hasOpportunitiesSearchPrefs", () => {
  it("returns true when job functions and experience labels are set", () => {
    expect(
      hasOpportunitiesSearchPrefs({
        prioritizedCategories: ["Product Jobs"],
        searchPreferences: { experienceLevelLabels: ["Mid Level"] },
      }),
    ).toBe(true);
  });

  it("returns true when job functions and parsed experienceLevel are set", () => {
    expect(
      hasOpportunitiesSearchPrefs({
        prioritizedCategories: ["Engineering Jobs"],
        searchPreferences: {},
        experienceLevel: "Senior",
      }),
    ).toBe(true);
  });

  it("returns false when job functions are missing", () => {
    expect(
      hasOpportunitiesSearchPrefs({
        prioritizedCategories: [],
        searchPreferences: { experienceLevelLabels: ["Mid Level"] },
      }),
    ).toBe(false);
  });
});

describe("shouldShowOpportunitiesPrefConfirm", () => {
  const base = {
    userId: "user-1",
    targetRoles: ["Product Manager"],
    prioritizedCategories: ["Product Jobs"],
    searchPreferences: {},
    skipStorage: true,
  };

  it("does not show when opportunitiesPrefConfirmedAt is set", () => {
    expect(
      shouldShowOpportunitiesPrefConfirm({
        ...base,
        searchPreferences: { opportunitiesPrefConfirmedAt: "2026-06-30T12:00:00.000Z" },
      }),
    ).toBe(false);
  });

  it("does not show when profile already has job functions and experience labels", () => {
    expect(
      shouldShowOpportunitiesPrefConfirm({
        ...base,
        searchPreferences: { experienceLevelLabels: ["Senior Level"] },
      }),
    ).toBe(false);
  });

  it("does not show when profile has job functions and resume experienceLevel", () => {
    expect(
      shouldShowOpportunitiesPrefConfirm({
        ...base,
        experienceLevel: "Senior",
      }),
    ).toBe(false);
  });

  it("shows after onboarding when profile is still incomplete", () => {
    expect(
      shouldShowOpportunitiesPrefConfirm({
        ...base,
        prioritizedCategories: [],
        onboardingJustFinished: true,
      }),
    ).toBe(true);
  });

  it("does not force show after onboarding when profile is already complete", () => {
    expect(
      shouldShowOpportunitiesPrefConfirm({
        ...base,
        searchPreferences: { experienceLevelLabels: ["Mid Level"] },
        onboardingJustFinished: true,
      }),
    ).toBe(false);
  });

  it("does not show for marketing profile with senior and lead experience labels", () => {
    expect(
      shouldShowOpportunitiesPrefConfirm({
        ...base,
        prioritizedCategories: ["Marketing Jobs"],
        searchPreferences: { experienceLevelLabels: ["Senior Level", "Lead / Staff"] },
      }),
    ).toBe(false);
  });

  it("does not show with empty profile snapshot before load would have shown", () => {
    expect(
      shouldShowOpportunitiesPrefConfirm({
        userId: null,
        targetRoles: [],
        prioritizedCategories: [],
        searchPreferences: {},
        skipStorage: true,
      }),
    ).toBe(true);
  });

  it("shows when job functions or experience are missing", () => {
    expect(
      shouldShowOpportunitiesPrefConfirm({
        ...base,
        prioritizedCategories: [],
      }),
    ).toBe(true);

    expect(
      shouldShowOpportunitiesPrefConfirm({
        ...base,
        prioritizedCategories: ["Product Jobs"],
        experienceLevel: null,
      }),
    ).toBe(true);
  });
});
