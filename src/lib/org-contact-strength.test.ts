import { describe, expect, it } from "vitest";
import { computeOrgContactStrengthScore } from "@/lib/org-contact-strength";
import type { OrgContactStrengthFactors } from "@/lib/org-contact-graph/types";

const base: OrgContactStrengthFactors = {
  emailCount: 0,
  meetingCount: 0,
  inboundCount: 0,
  outboundCount: 0,
  oneOnOneMeetingCount: 0,
  groupMeetingCount: 0,
  recentSubjects: [],
  recentMeetings: [],
  lastEmailAt: null,
  lastMeetingAt: null,
};

describe("computeOrgContactStrengthScore", () => {
  it("returns 0 for empty factors", () => {
    expect(computeOrgContactStrengthScore(base)).toBe(0);
  });

  it("rewards bidirectional email and recent activity", () => {
    const score = computeOrgContactStrengthScore({
      ...base,
      emailCount: 8,
      inboundCount: 4,
      outboundCount: 4,
      lastEmailAt: new Date().toISOString(),
    });
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("weights 1:1 meetings higher than group meetings", () => {
    const oneOnOne = computeOrgContactStrengthScore({
      ...base,
      meetingCount: 3,
      oneOnOneMeetingCount: 3,
      lastMeetingAt: new Date().toISOString(),
    });
    const group = computeOrgContactStrengthScore({
      ...base,
      meetingCount: 3,
      groupMeetingCount: 3,
      lastMeetingAt: new Date().toISOString(),
    });
    expect(oneOnOne).toBeGreaterThan(group);
  });
});
