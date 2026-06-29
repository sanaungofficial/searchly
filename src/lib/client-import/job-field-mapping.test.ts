import { describe, expect, it } from "vitest";
import {
  buildPipelineJobsFromMapping,
  buildStatusValueMappingFromRows,
  parseJobTrackerSheetFromText,
  suggestJobTrackerMappings,
  validateJobTrackerMapping,
  validateStatusValueMapping,
} from "./job-field-mapping";

describe("job-field-mapping", () => {
  const sampleTsv = `Company Name\tJob Title\tURL\tApplication Status\tApplication Date\tNotes
Acme Corp\tProduct Manager\thttps://jobs.example.com/pm\tApplied\t2024-01-15\tGreat fit
Beta Inc\tEngineer\thttps://jobs.example.com/eng\tInterviewing\t2024-02-01\t`;

  it("suggests standard column mappings from headers", () => {
    const headers = ["Company Name", "Job Title", "URL", "Yes/No", "Application Status"];
    const map = suggestJobTrackerMappings(headers);
    expect(map.get(0)).toBe("company");
    expect(map.get(1)).toBe("role");
    expect(map.get(2)).toBe("url");
    expect(map.get(4)).toBe("status");
  });

  it("parses pasted rows into sheet preview with samples", () => {
    const preview = parseJobTrackerSheetFromText(sampleTsv, "paste.txt");
    expect(preview.columns.some((c) => c.destination === "company")).toBe(true);
    expect(preview.columns.some((c) => c.destination === "role")).toBe(true);
    expect(preview.dataRowCount).toBe(2);
    const companyCol = preview.columns.find((c) => c.destination === "company");
    expect(companyCol?.sampleValues[0]).toBe("Acme Corp");
  });

  it("builds pipeline jobs from explicit mapping", () => {
    const preview = parseJobTrackerSheetFromText(sampleTsv, "paste.txt");
    const jobs = buildPipelineJobsFromMapping(preview, preview.columns);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.data.company).toBe("Acme Corp");
    expect(jobs[0]?.data.role).toBe("Product Manager");
    expect(jobs[0]?.data.stage).toBe("APPLIED");
  });

  it("requires company and role mappings", () => {
    const preview = parseJobTrackerSheetFromText(sampleTsv, "paste.txt");
    const badCols = preview.columns.map((c) =>
      c.destination === "company" ? { ...c, destination: null } : c,
    );
    expect(validateJobTrackerMapping(badCols)).toMatch(/Company and Job title/);
  });

  it("maps custom status values via user value mapping", () => {
    const tsv = `Company Name\tJob Title\tApplication Status
Acme Corp\tPM\tPosition filled
Beta Inc\tEng\tApplied`;
    const preview = parseJobTrackerSheetFromText(tsv, "paste.txt");
    const mapping = buildStatusValueMappingFromRows(
      [{ rawValue: "Position filled", count: 1, autoMappedStage: null, userStage: "REJECTED" }],
      null,
    );
    const jobs = buildPipelineJobsFromMapping(preview, preview.columns, { statusValueMapping: mapping });
    expect(jobs.find((j) => j.data.company === "Acme Corp")?.data.stage).toBe("REJECTED");
    expect(jobs.find((j) => j.data.company === "Beta Inc")?.data.stage).toBe("APPLIED");
  });

  it("uses default stage for unmatched status values", () => {
    const tsv = `Company Name\tJob Title\tApplication Status
Acme Corp\tPM\tPosition filled`;
    const preview = parseJobTrackerSheetFromText(tsv, "paste.txt");
    const mapping = buildStatusValueMappingFromRows([], "SAVED");
    expect(validateStatusValueMapping(preview, preview.columns, mapping)).toBeNull();
    const jobs = buildPipelineJobsFromMapping(preview, preview.columns, { statusValueMapping: mapping });
    expect(jobs[0]?.data.stage).toBe("SAVED");
  });

  it("blocks import when unmatched status values have no mapping", () => {
    const tsv = `Company Name\tJob Title\tApplication Status
Acme Corp\tPM\tPosition filled`;
    const preview = parseJobTrackerSheetFromText(tsv, "paste.txt");
    expect(validateStatusValueMapping(preview, preview.columns)).toMatch(/Position filled/);
  });
});
