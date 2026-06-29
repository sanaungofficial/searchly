import { describe, expect, it } from "vitest";
import {
  buildCompaniesFromMapping,
  buildCompaniesImportPreview,
  buildCompaniesMappingRecommendation,
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

  it("suggests standard column mappings from headers", () => {
    const headers = [
      "Company",
      "Industry",
      "Location/HQ",
      "Approx. Drive from Burnaby",
      "Local Asset Base",
      "Fit Notes",
      "Priority (High/Medium/Low)",
    ];
    const map = suggestCompaniesMappings(headers);
    expect(map.get(0)).toBe("company");
    expect(map.get(1)).toBe("notes");
    expect(map.get(6)).toBe("priority");
  });

  it("parses pasted rows into sheet preview with samples", () => {
    const preview = parseCompaniesSheetFromText(sampleTsv, "paste.txt");
    expect(preview.columns.some((c) => c.destination === "company")).toBe(true);
    expect(preview.columns.some((c) => c.destination === "priority")).toBe(true);
    expect(preview.dataRowCount).toBeGreaterThanOrEqual(4);
  });

  it("builds companies with structured notes and priority", () => {
    const preview = parseCompaniesSheetFromText(sampleTsv, "paste.txt");
    const companies = buildCompaniesFromMapping(preview, preview.columns);
    expect(companies).toHaveLength(3);
    const acme = companies.find((c) => c.data.name === "Acme Mining Corp");
    expect(acme?.data.priority).toBe("HIGH");
    expect(acme?.data.notes).toContain("**Industry:** Mining");
    expect(acme?.data.notes).toContain("**Fit Notes:** Strong BC presence");
    expect(acme?.data.notes).toContain("**Category:** Primary Industries");
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
    expect(mappingRecommendation).toMatch(/minimal field map/i);
    expect(mappingRecommendation).toMatch(/notes/i);
    const standalone = buildCompaniesMappingRecommendation(preview.columns, 3);
    expect(standalone).toContain("Company");
  });

  it("skips section header rows", () => {
    const preview = parseCompaniesSheetFromText(sampleTsv, "paste.txt");
    const companies = buildCompaniesFromMapping(preview, preview.columns);
    expect(companies.some((c) => /primary industries/i.test(c.data.name))).toBe(false);
  });
});
