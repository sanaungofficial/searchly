import { describe, expect, it } from "vitest";
import {
  buildOnboardingPriorities,
  buildOnboardingProfilePatch,
} from "@/lib/onboarding-preferences";

describe("buildOnboardingPriorities", () => {
  it("maps remote + domestic relocation + visa", () => {
    expect(
      buildOnboardingPriorities({
        workArrangement: "remote_only",
        relocation: "domestic",
        visaNeed: "sponsored",
        fullyRemote: false,
      }),
    ).toEqual(["Remote-first", "Open to relocating within my country", "Need visa sponsorship"]);
  });

  it("uses fullyRemote flag for remote-first", () => {
    expect(
      buildOnboardingPriorities({
        workArrangement: "",
        relocation: "local",
        visaNeed: "authorized",
        fullyRemote: true,
      }),
    ).toEqual(["Remote-first"]);
  });
});

describe("buildOnboardingProfilePatch", () => {
  it("clears target market when fully remote", () => {
    const patch = buildOnboardingProfilePatch({
      targetMarket: "Austin, TX",
      fullyRemote: true,
      workArrangement: "remote_only",
      relocation: "local",
      visaNeed: "unspecified",
      targetSalary: "$150K – $200K",
      jobTimeline: "asap",
      deprioritizedCategories: ["Sales Jobs"],
    });
    expect(patch.targetMarket).toBeNull();
    expect(patch.deprioritizedCategories).toEqual(["Sales Jobs"]);
  });
});
