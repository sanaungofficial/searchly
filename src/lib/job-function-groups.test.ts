import { describe, expect, it } from "vitest";
import {
  groupHirebaseJobCategories,
  jobFunctionBreadcrumb,
  displayJobFunctionLabel,
} from "@/lib/job-function-groups";

describe("groupHirebaseJobCategories", () => {
  it("groups engineering and product under software", () => {
    const groups = groupHirebaseJobCategories(["Engineering Jobs", "Product Jobs", "Sales Jobs"]);
    const software = groups.find((g) => g.id === "software");
    expect(software?.categories).toEqual(expect.arrayContaining(["Engineering Jobs", "Product Jobs"]));
    const sales = groups.find((g) => g.id === "sales");
    expect(sales?.categories).toContain("Sales Jobs");
  });

  it("groups accounting under finance, not sales", () => {
    const groups = groupHirebaseJobCategories(["Accounting Jobs", "Sales Jobs"]);
    const finance = groups.find((g) => g.id === "finance");
    expect(finance?.categories).toContain("Accounting Jobs");
    const sales = groups.find((g) => g.id === "sales");
    expect(sales?.categories).toContain("Sales Jobs");
    expect(sales?.categories).not.toContain("Accounting Jobs");
  });

  it("groups arts under creative, not software", () => {
    const groups = groupHirebaseJobCategories(["Arts Jobs", "Engineering Jobs"]);
    const creative = groups.find((g) => g.id === "creative");
    expect(creative?.categories).toContain("Arts Jobs");
    const software = groups.find((g) => g.id === "software");
    expect(software?.categories).toContain("Engineering Jobs");
    expect(software?.categories).not.toContain("Arts Jobs");
  });

  it("strips Jobs suffix for display", () => {
    expect(displayJobFunctionLabel("Backend Engineer Jobs")).toBe("Backend Engineer");
  });

  it("builds breadcrumb with parent only for top-level categories", () => {
    expect(jobFunctionBreadcrumb("Engineering Jobs", "Software / Internet / AI")).toBe(
      "Software / Internet / AI",
    );
  });

  it("builds breadcrumb with parent > child for specific roles", () => {
    expect(jobFunctionBreadcrumb("Backend Engineer Jobs", "Software / Internet / AI")).toBe(
      "Software / Internet / AI > Backend Engineer",
    );
  });
});
