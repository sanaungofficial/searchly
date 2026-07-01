import { describe, expect, it } from "vitest";
import { recommendationTuningGaps, recommendationTuningPct } from "@/lib/recommendation-tuning";

describe("recommendationTuningPct", () => {
  it("returns 100 when all matching signals present", () => {
    const pct = recommendationTuningPct({
      targetRoles: ["Product Manager"],
      targetMarket: "Austin, TX",
      priorities: ["Remote-first"],
      relocationOpenness: "Prefer to stay in my current area",
      workAuthorization: "Authorized to work without sponsorship",
      targetSalary: "$150K – $200K",
      jobTimeline: "asap",
      dashboardGoals: [{ id: "1", category: "job_search", value: "land_new_role", label: "Land", createdAt: "" }],
      resumeUrl: "https://example.com/r.pdf",
    });
    expect(pct).toBe(100);
    expect(recommendationTuningGaps({ targetRoles: ["PM", "Director"] })).toHaveLength(0);
  });
});
