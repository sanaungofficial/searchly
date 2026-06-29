import { describe, expect, it } from "vitest";
import {
  buildCoachProfileEducationEntries,
  buildCoachProfileExperienceEntries,
  parseCoachSchoolEntry,
} from "@/lib/coach-profile-experience";

describe("coach profile experience", () => {
  it("builds current and past roles from coach fields", () => {
    const entries = buildCoachProfileExperienceEntries({
      currentRole: "Executive Coach",
      currentCompany: "Second Ladder",
      firms: ["Google", "Second Ladder"],
    });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ title: "Executive Coach", company: "Second Ladder", dateLabel: "Present" });
    expect(entries[1]).toMatchObject({ company: "Google", title: null });
  });

  it("parses school degree strings", () => {
    expect(parseCoachSchoolEntry("Harvard Business School — MBA")).toEqual({
      school: "Harvard Business School",
      degree: "MBA",
    });
  });

  it("builds education entries from schools list", () => {
    const entries = buildCoachProfileEducationEntries(["Stanford — MS Computer Science"]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.school).toBe("Stanford");
    expect(entries[0]?.degree).toBe("MS Computer Science");
  });
});
