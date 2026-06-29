import { describe, expect, it } from "vitest";
import { detectJobTrackerColumns } from "./job-columns";

describe("detectJobTrackerColumns", () => {
  it("finds standard Google Sheet job tracker headers", () => {
    const headers = [
      "Company Name",
      "Job Title",
      "URL",
      "Yes/No",
      "Application Status",
      "Application Date",
      "Notes (Please add notes)",
      "Resume Link",
    ];
    const cols = detectJobTrackerColumns(headers);
    expect(cols.companyCol).toBe(0);
    expect(cols.roleCol).toBe(1);
    expect(cols.urlCol).toBe(2);
    expect(cols.yesNoCol).toBe(3);
    expect(cols.statusCol).toBe(4);
    expect(cols.dateCol).toBe(5);
    expect(cols.notesCol).toBe(6);
    expect(cols.resumeCol).toBe(7);
  });

  it("does not map Yes/No column to application status", () => {
    const headers = ["Company Name", "Job Title", "Yes/No", "URL"];
    const cols = detectJobTrackerColumns(headers);
    expect(cols.yesNoCol).toBe(2);
    expect(cols.statusCol).toBe(-1);
  });
});
