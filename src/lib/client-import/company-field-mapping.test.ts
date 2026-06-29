import { describe, expect, it } from "vitest";
import {
  buildCompaniesFromMapping,
  buildCompaniesImportPreview,
  buildCompaniesMappingRecommendation,
  buildCompanyNotesFromRow,
  parseCompaniesSheetFromText,
  suggestCompaniesMappings,
  validateCompaniesMapping,
} from "./company-field-mapping";

describe("company-field-mapping", () => {
  const sampleTsv = `Company\tIndustry\tLocation/HQ\tApprox. Drive from Burnaby\tLocal Asset Base\tFit Notes\tPriority (High/Medium/Low)
Primary Industries
Acme Mining Corp\tMining\tVancouver, BC\t45 min\tLarge fleet\tStrong BC presence\tHigh
Beta Engineering\tEngineering services\tBurnaby, BC\t20 min\tRegional offices\tGood culture fit\tMedium
Secondary
Gamma Holdings\tConglomerate\tCalgary, AB\t6 hr\tNational\tStretch role\tLow`;

  const targetHeaders = [
    "Company",
    "Industry",
    "Location/HQ",
    "Approx. Drive from Burnaby",
    "Local Asset Base",
    "Fit Notes",
    "Priority (High/Medium/Low)",
  ];

  it("suggests only company and priority from headers", () => {
    const map = suggestCompaniesMappings(targetHeaders);
    expect(map.get(0)).toBe("company");
    expect(map.get(6)).toBe("priority");
    expect(map.get(1)).toBeUndefined();
    expect(map.get(2)).toBeUndefined();
  });

  it("parses pasted rows into sheet preview with samples", () => {
    const preview = parseCompaniesSheetFromText(sampleTsv, "paste.txt");
    expect(preview.columns.some((c) => c.destination === "company")).toBe(true);
    expect(preview.columns.some((c) => c.destination === "priority")).toBe(true);
    expect(preview.dataRowCount).toBeGreaterThanOrEqual(4);
  });

  it("buildCompanyNotesFromRow formats one line per field", () => {
    const row = [
      "Acme Mining Corp",
      "Mining",
      "Vancouver, BC",
      "45 min",
      "Large fleet",
      "Strong BC presence",
      "High",
    ];
    const notes = buildCompanyNotesFromRow(row, targetHeaders, 0, 6, {
      category: "Primary Industries",
    });
    expect(notes).toContain("Category: Primary Industries");
    expect(notes).toContain("Industry: Mining");
    expect(notes).toContain("Location/Hq: Vancouver, BC");
    expect(notes).toContain("Fit Notes: Strong BC presence");
    expect(notes).not.toContain("High");
  });

  it("builds companies with structured notes and priority", () => {
    const preview = parseCompaniesSheetFromText(sampleTsv, "paste.txt");
    const companies = buildCompaniesFromMapping(preview, preview.columns);
    expect(companies).toHaveLength(3);
    const acme = companies.find((c) => c.data.name === "Acme Mining Corp");
    expect(acme?.data.priority).toBe("HIGH");
    expect(acme?.data.notes).toContain("Industry: Mining");
    expect(acme?.data.notes).toContain("Fit Notes: Strong BC presence");
    expect(acme?.data.notes).toContain("Category: Primary Industries");
  });

  it("requires company mapping", () => {
    const preview = parseCompaniesSheetFromText(sampleTsv, "paste.txt");
    const badCols = preview.columns.map((c) =>
      c.destination === "company" ? { ...c, destination: null } : c,
    );
    expect(validateCompaniesMapping(badCols)).toMatch(/Company column/);
  });

  it("returns mapping recommendation text", () => {
    const preview = parseCompaniesSheetFromText(sampleTsv, "paste.txt");
    const { mappingRecommendation, companies } = buildCompaniesImportPreview(preview, preview.columns);
    expect(companies.length).toBe(3);
    expect(mappingRecommendation).toMatch(/merged into each company's notes/i);
    const standalone = buildCompaniesMappingRecommendation(preview.columns, 3);
    expect(standalone).toContain("Company");
  });

  it("skips section header rows", () => {
    const preview = parseCompaniesSheetFromText(sampleTsv, "paste.txt");
    const companies = buildCompaniesFromMapping(preview, preview.columns);
    expect(companies.some((c) => /primary industries/i.test(c.data.name))).toBe(false);
  });

  it("respects includeUnmappedInNotes=false", () => {
    const preview = parseCompaniesSheetFromText(sampleTsv, "paste.txt");
    const companies = buildCompaniesFromMapping(preview, preview.columns, {
      includeUnmappedInNotes: false,
    });
    const acme = companies.find((c) => c.data.name === "Acme Mining Corp");
    expect(acme?.data.notes).toBe("Category: Primary Industries");
  });
});
