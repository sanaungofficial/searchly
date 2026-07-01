import { describe, expect, it } from "vitest";
import {
  dbStatusesForCanonical,
  normalizeContactStatus,
} from "./contact-status";

describe("contact-status migration", () => {
  it("maps legacy statuses to canonical values", () => {
    expect(normalizeContactStatus("outreach")).toBe("in_conversation");
    expect(normalizeContactStatus("replied")).toBe("in_conversation");
    expect(normalizeContactStatus("active")).toBe("in_conversation");
    expect(normalizeContactStatus("meeting")).toBe("meeting_scheduled");
    expect(normalizeContactStatus("not_interested")).toBe("archived");
    expect(normalizeContactStatus("on_hold")).toBe("archived");
    expect(normalizeContactStatus("new")).toBe("new");
  });

  it("expands canonical filters to legacy DB values", () => {
    expect(dbStatusesForCanonical("in_conversation")).toContain("outreach");
    expect(dbStatusesForCanonical("meeting_scheduled")).toContain("meeting");
    expect(dbStatusesForCanonical("archived")).toContain("not_interested");
  });
});
