import { describe, expect, it } from "vitest";
import {
  isGenericNetworkCompanyLabel,
  networkExecThreadEmployerLabel,
} from "./network-employer-labels";

describe("networkExecThreadEmployerLabel", () => {
  it("returns confidential label instead of company summary text", () => {
    expect(
      networkExecThreadEmployerLabel({
        companySummary: "Biotechnology company developing differentiated oncology pipeline.",
        industries: ["Biotechnology", "Privately Held"],
      }),
    ).toBe("Confidential employer");
  });

  it("uses named company when not generic", () => {
    expect(
      networkExecThreadEmployerLabel({
        companyName: "Acme Biotech",
        industries: ["Biotechnology"],
      }),
    ).toBe("Acme Biotech");
  });
});

describe("isGenericNetworkCompanyLabel", () => {
  it("flags confidential labels", () => {
    expect(isGenericNetworkCompanyLabel("Confidential employer")).toBe(true);
    expect(isGenericNetworkCompanyLabel("Recruiting firm")).toBe(true);
  });
});
