import { describe, expect, it } from "vitest";
import { suggestFromOneliner } from "@/lib/onboarding-oneliner-suggestions";

describe("suggestFromOneliner", () => {
  it("maps strategy and MBA language to consulting categories and roles", () => {
    const result = suggestFromOneliner(
      "Strategy & Digital Transformation | Growth Systems Builder | MBA",
    );
    expect(result.prioritizedCategories.some((c) => /Consulting|Operations/i.test(c))).toBe(true);
    expect(result.targetRoles.some((r) => /Strategy/i.test(r))).toBe(true);
  });

  it("detects categories to avoid from negation", () => {
    const result = suggestFromOneliner("Product leader — not interested in sales roles");
    expect(result.deprioritizedCategories).toContain("Sales Jobs");
  });

  it("infers remote work preference", () => {
    const result = suggestFromOneliner("Remote-first product operator based in Austin");
    expect(result.workArrangement).toBe("remote_only");
    expect(result.targetMarket).toMatch(/Austin/i);
  });
});
