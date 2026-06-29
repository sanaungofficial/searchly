import { describe, expect, it } from "vitest";
import { mapImportJobStage, parseImportApproved } from "./job-status-map";

describe("mapImportJobStage", () => {
  it("maps common application statuses without defaulting to APPLIED", () => {
    expect(mapImportJobStage({ statusRaw: "Interviewing", approved: null, appliedAt: null })).toBe(
      "INTERVIEWING",
    );
    expect(mapImportJobStage({ statusRaw: "Offer", approved: null, appliedAt: null })).toBe("OFFER");
    expect(mapImportJobStage({ statusRaw: "Rejected", approved: null, appliedAt: null })).toBe("REJECTED");
    expect(mapImportJobStage({ statusRaw: "Saved", approved: null, appliedAt: null })).toBe("SAVED");
    expect(mapImportJobStage({ statusRaw: "Applying", approved: null, appliedAt: null })).toBe("APPLYING");
    expect(mapImportJobStage({ statusRaw: "Phone Screen", approved: null, appliedAt: null })).toBe("SCREENING");
  });

  it("defaults empty status to SAVED, not APPLIED", () => {
    expect(mapImportJobStage({ statusRaw: "", approved: null, appliedAt: null })).toBe("SAVED");
    expect(mapImportJobStage({ statusRaw: "Pending", approved: null, appliedAt: null })).toBe("SAVED");
  });

  it("uses application date as APPLIED signal when status blank", () => {
    expect(mapImportJobStage({ statusRaw: "", approved: null, appliedAt: "2024-06-01" })).toBe("APPLIED");
  });

  it("gates APPLIED when coach approval is No", () => {
    expect(mapImportJobStage({ statusRaw: "Applied", approved: false, appliedAt: null })).toBe("SAVED");
    expect(mapImportJobStage({ statusRaw: "Applied", approved: true, appliedAt: null })).toBe("APPLIED");
  });

  it("does not treat Yes/No column values as application status", () => {
    expect(mapImportJobStage({ statusRaw: "Yes", approved: null, appliedAt: null })).toBe("APPLIED");
    expect(mapImportJobStage({ statusRaw: "No", approved: null, appliedAt: null })).toBe("SAVED");
  });

  it("maps Closed status to REJECTED, not Saved", () => {
    expect(mapImportJobStage({ statusRaw: "Closed", approved: null, appliedAt: null })).toBe("REJECTED");
    expect(mapImportJobStage({ statusRaw: "Position closed", approved: null, appliedAt: null })).toBe("REJECTED");
  });

  it("gates APPLYING when coach approval is No", () => {
    expect(mapImportJobStage({ statusRaw: "Applying", approved: false, appliedAt: null })).toBe("SAVED");
  });

  it("applies user status value mapping before auto rules", () => {
    expect(
      mapImportJobStage(
        { statusRaw: "Position filled", approved: null, appliedAt: null },
        { valueToStage: { "Position filled": "REJECTED" }, defaultUnmatchedStage: null },
      ),
    ).toBe("REJECTED");
  });
});

describe("parseImportApproved", () => {
  it("parses yes/no variants", () => {
    expect(parseImportApproved("Yes")).toBe(true);
    expect(parseImportApproved("no")).toBe(false);
    expect(parseImportApproved("")).toBe(null);
  });
});
